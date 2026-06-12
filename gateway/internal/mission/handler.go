package mission

import "github.com/gofiber/fiber/v2"

// Handlers are stubbed here and fully implemented in Phase 3.

func HandleGetMissions(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"missions": []interface{}{}})
}

func HandleCreateMission(c *fiber.Ctx) error {
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented yet"})
}

func HandleGetMission(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"mission": nil})
}

func HandleUpdateMissionStatus(c *fiber.Ctx) error {
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "not implemented yet"})
}
