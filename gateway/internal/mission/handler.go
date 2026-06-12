package mission

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
)

const dbTimeout = 10 * time.Second

// HandleGetMissions returns all missions from the database.
func HandleGetMissions(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	missions, err := List(ctx)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to fetch missions: " + err.Error(),
		})
	}

	if missions == nil {
		missions = []Mission{}
	}

	return c.JSON(fiber.Map{"missions": missions})
}

// HandleCreateMission validates the request body, creates a mission record,
// and stubs the planner call (wired via gRPC in Phase 4).
func HandleCreateMission(c *fiber.Ctx) error {
	operatorID, _ := c.Locals("operator_id").(string)
	if operatorID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "operator not authenticated",
		})
	}

	var req CreateMissionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body: " + err.Error(),
		})
	}

	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "mission name is required",
		})
	}
	if len(req.ZoneGeoJSON) < 3 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "zone_geojson must have at least 3 coordinate pairs to form a polygon",
		})
	}

	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	mission, err := Create(ctx, req, operatorID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to create mission: " + err.Error(),
		})
	}

	// Phase 4 will replace this comment with a real gRPC call to the Python planner.
	// The planner will receive the zone polygon and drone count, and return
	// boustrophedon sub-zones with waypoints per drone.

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"mission": mission,
		"note":    "planner integration pending — Phase 4",
	})
}

// HandleGetMission fetches a single mission with its assignments.
func HandleGetMission(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "mission id is required",
		})
	}

	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	mission, err := GetByID(ctx, id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "mission not found: " + err.Error(),
		})
	}

	assignments, err := GetAssignments(ctx, id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to fetch assignments: " + err.Error(),
		})
	}

	if assignments == nil {
		assignments = []Assignment{}
	}

	return c.JSON(fiber.Map{
		"mission":     mission,
		"assignments": assignments,
	})
}

// HandleUpdateMissionStatus patches the status of a mission.
func HandleUpdateMissionStatus(c *fiber.Ctx) error {
	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "mission id is required",
		})
	}

	var req UpdateStatusRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body: " + err.Error(),
		})
	}

	validStatuses := map[Status]bool{
		StatusPending:   true,
		StatusPlanning:  true,
		StatusActive:    true,
		StatusCompleted: true,
		StatusAborted:   true,
		StatusFault:     true,
	}
	if !validStatuses[req.Status] {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid status value",
		})
	}

	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	mission, err := UpdateStatus(ctx, id, req.Status)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to update mission status: " + err.Error(),
		})
	}

	return c.JSON(fiber.Map{"mission": mission})
}
