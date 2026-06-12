package auth

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

// Protected is a Fiber middleware that validates the JWT Bearer token.
// On success it stores operator claims in the request context locals.
func Protected() fiber.Handler {
	return func(c *fiber.Ctx) error {
		header := c.Get("Authorization")
		if header == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "missing Authorization header",
			})
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "malformed Authorization header — expected: Bearer <token>",
			})
		}

		claims, err := ParseToken(parts[1])
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": err.Error(),
			})
		}

		// Inject claims into locals so handlers can read them without re-parsing.
		c.Locals("operator_id", claims.OperatorID)
		c.Locals("username", claims.Username)
		c.Locals("role", claims.Role)

		return c.Next()
	}
}

// AdminOnly is a Fiber middleware that allows only operators with role "admin".
// Must be placed after Protected().
func AdminOnly() fiber.Handler {
	return func(c *fiber.Ctx) error {
		role, _ := c.Locals("role").(string)
		if role != "admin" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "admin role required",
			})
		}
		return c.Next()
	}
}
