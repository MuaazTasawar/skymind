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
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"
)

func main() {
	// ── Load .env (ignored in production Docker where env is injected) ──
	_ = godotenv.Load("../.env")

	// ── Database ────────────────────────────────────────────────────────
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := db.Connect(ctx); err != nil {
		log.Fatalf("[gateway] fatal: %v", err)
	}
	defer db.Close()

	// ── Fiber app ───────────────────────────────────────────────────────
	app := fiber.New(fiber.Config{
		AppName:      "SkyMind Gateway v1.0",
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	})

	// ── Global middleware ────────────────────────────────────────────────
	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} ${method} ${path} ${latency}\n",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	}))

	// ── Health check ─────────────────────────────────────────────────────
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":    "ok",
			"service":   "skymind-gateway",
			"timestamp": time.Now().UTC(),
		})
	})

	// ── Auth routes (public) ─────────────────────────────────────────────
	authGroup := app.Group("/api/auth")
	authGroup.Post("/login", handleLogin)
	authGroup.Post("/register", handleRegister)

	// ── Protected API routes ─────────────────────────────────────────────
	api := app.Group("/api", auth.Protected())

	// Drone fleet
	api.Get("/drones", handleGetDrones)
	api.Get("/drones/:id", handleGetDrone)

	// Missions (handlers wired in Phase 3)
	api.Get("/missions", handleGetMissions)
	api.Post("/missions", handleCreateMission)
	api.Get("/missions/:id", handleGetMission)
	api.Patch("/missions/:id/status", handleUpdateMissionStatus)

	// WebSocket telemetry (Phase 2)
	app.Get("/ws", handleWebSocket)

	// ── Graceful shutdown ────────────────────────────────────────────────
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
	if err := app.ShutdownWithTimeout(10 * time.Second); err != nil {
		log.Printf("[gateway] shutdown error: %v", err)
	}
	fmt.Println("[gateway] stopped")
}

// ── Stub handlers (replaced in later phases) ────────────────────────────────

func handleLogin(c *fiber.Ctx) error {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}

	// TODO Phase 3: query operators table and verify bcrypt hash
	// Temporary: accept admin/skymind123 for development
	if body.Username != "admin" || body.Password != "skymind123" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid credentials"})
	}

	token, err := auth.GenerateToken("00000000-0000-0000-0000-000000000001", body.Username, "admin")
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"token":    token,
		"username": body.Username,
		"role":     "admin",
	})
}

func handleRegister(c *fiber.Ctx) error {
	// TODO Phase 3: full operator registration with bcrypt + DB insert
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented yet"})
}

func handleGetDrones(c *fiber.Ctx) error {
	// TODO Phase 2: return live fleet state from fleet manager
	return c.JSON(fiber.Map{"drones": []interface{}{}})
}

func handleGetDrone(c *fiber.Ctx) error {
	// TODO Phase 2: return single drone state
	return c.JSON(fiber.Map{"drone": nil})
}

func handleGetMissions(c *fiber.Ctx) error {
	// TODO Phase 3: query missions from DB
	return c.JSON(fiber.Map{"missions": []interface{}{}})
}

func handleCreateMission(c *fiber.Ctx) error {
	// TODO Phase 3: create mission + call planner via gRPC
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented yet"})
}

func handleGetMission(c *fiber.Ctx) error {
	// TODO Phase 3: query single mission
	return c.JSON(fiber.Map{"mission": nil})
}

func handleUpdateMissionStatus(c *fiber.Ctx) error {
	// TODO Phase 3: update mission status
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented yet"})
}

func handleWebSocket(c *fiber.Ctx) error {
	// TODO Phase 2: upgrade to WebSocket and register with hub
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "WebSocket not wired yet"})
}
