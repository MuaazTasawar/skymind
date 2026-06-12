package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/MuaazTasawar/skymind/gateway/internal/auth"
	"github.com/MuaazTasawar/skymind/gateway/internal/db"
	"github.com/MuaazTasawar/skymind/gateway/internal/mavlink"
	"github.com/MuaazTasawar/skymind/gateway/internal/mission"
	"github.com/MuaazTasawar/skymind/gateway/internal/telemetry"
	"github.com/MuaazTasawar/skymind/gateway/internal/ws"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	fiberws "github.com/gofiber/websocket/v2"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load("../.env")

	// ── DB ───────────────────────────────────────────────────────────────
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	dbCtx, dbCancel := context.WithTimeout(ctx, 30*time.Second)
	defer dbCancel()
	if err := db.Connect(dbCtx); err != nil {
		log.Fatalf("[gateway] fatal: %v", err)
	}
	defer db.Close()

	// ── Fleet ────────────────────────────────────────────────────────────
	fleet := mavlink.NewFleet()
	fleet.RegisterDrone(mavlink.DroneConfig{ID: "drone-1", Name: "Alpha", SITLPort: 5760})
	fleet.RegisterDrone(mavlink.DroneConfig{ID: "drone-2", Name: "Bravo", SITLPort: 5770})
	fleet.RegisterDrone(mavlink.DroneConfig{ID: "drone-3", Name: "Charlie", SITLPort: 5780})
	fleet.RegisterDrone(mavlink.DroneConfig{ID: "drone-4", Name: "Delta", SITLPort: 5790})
	fleet.RegisterDrone(mavlink.DroneConfig{ID: "drone-5", Name: "Echo", SITLPort: 5800})
	defer fleet.StopAll()

	// ── WebSocket hub + broadcaster ──────────────────────────────────────
	hub := ws.NewHub()
	broadcaster := telemetry.NewBroadcaster(fleet, hub)
	broadcaster.Start(ctx)

	// ── Fault watcher — log faults, emit WS events ───────────────────────
	fleet.WatchFaults(ctx, func(droneID string) {
		snap, ok := fleet.GetDrone(droneID)
		if !ok {
			return
		}
		broadcaster.SendEvent(telemetry.EventDroneFault, telemetry.FaultEvent{
			DroneID:   droneID,
			DroneName: snap.Name,
			Reason:    "battery_failsafe_or_heartbeat_timeout",
			At:        time.Now().UTC(),
		})
	})

	// ── Fiber ────────────────────────────────────────────────────────────
	app := fiber.New(fiber.Config{
		AppName:      "SkyMind Gateway v1.0",
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	})

	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} ${method} ${path} ${latency}\n",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	}))

	// ── Health ───────────────────────────────────────────────────────────
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":    "ok",
			"service":   "skymind-gateway",
			"clients":   hub.ClientCount(),
			"timestamp": time.Now().UTC(),
		})
	})

	// ── Auth (public) ────────────────────────────────────────────────────
	authGroup := app.Group("/api/auth")
	authGroup.Post("/login", handleLogin)
	authGroup.Post("/register", handleRegister)

	// ── Protected API ────────────────────────────────────────────────────
	api := app.Group("/api", auth.Protected())

	api.Get("/drones", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"drones": fleet.GetAllDrones()})
	})

	api.Get("/drones/:id", func(c *fiber.Ctx) error {
		snap, ok := fleet.GetDrone(c.Params("id"))
		if !ok {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "drone not found"})
		}
		return c.JSON(fiber.Map{"drone": snap})
	})

	// Missions (stubbed — wired in Phase 3)
	api.Get("/missions", mission.HandleGetMissions)
	api.Post("/missions", mission.HandleCreateMission)
	api.Get("/missions/:id", mission.HandleGetMission)
	api.Patch("/missions/:id/status", mission.HandleUpdateMissionStatus)

	// ── WebSocket ─────────────────────────────────────────────────────────
	app.Use("/ws", func(c *fiber.Ctx) error {
		if fiberws.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	app.Get("/ws", fiberws.New(func(c *fiberws.Conn) {
		clientID := uuid.New().String()
		hub.Register(clientID, c)

		// Read pump — keep connection alive and handle client disconnect
		for {
			_, _, err := c.ReadMessage()
			if err != nil {
				hub.Unregister(clientID)
				break
			}
		}
	}))

	// ── Graceful shutdown ─────────────────────────────────────────────────
	port := os.Getenv("GATEWAY_PORT")
	if port == "" {
		port = "8080"
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		fmt.Printf("[gateway] listening on :%s\n", port)
		if err := app.Listen(":" + port); err != nil {
			log.Fatalf("[gateway] listen error: %v", err)
		}
	}()

	<-quit
	fmt.Println("[gateway] shutting down...")
	cancel()
	if err := app.ShutdownWithTimeout(10 * time.Second); err != nil {
		log.Printf("[gateway] shutdown error: %v", err)
	}
	fmt.Println("[gateway] stopped")
}

// ── Auth handlers ─────────────────────────────────────────────────────────────

func handleLogin(c *fiber.Ctx) error {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	if body.Username != "admin" || body.Password != "skymind123" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid credentials"})
	}
	token, err := auth.GenerateToken("00000000-0000-0000-0000-000000000001", body.Username, "admin")
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"token": token, "username": body.Username, "role": "admin"})
}

func handleRegister(c *fiber.Ctx) error {
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented yet"})
}

func handleGetMissions(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"missions": []interface{}{}})
}

func handleCreateMission(c *fiber.Ctx) error {
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented yet"})
}

func handleGetMission(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"mission": nil})
}

func handleUpdateMissionStatus(c *fiber.Ctx) error {
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented yet"})
}
