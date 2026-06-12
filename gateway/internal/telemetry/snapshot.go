package telemetry

import (
	"time"

	"github.com/MuaazTasawar/skymind/gateway/internal/mavlink"
)

// FleetSnapshot is the full telemetry payload broadcast to all WebSocket clients
// every 500ms (2 Hz).
type FleetSnapshot struct {
	Timestamp time.Time            `json:"timestamp"`
	Drones    []mavlink.DroneState `json:"drones"`
}

// EventType classifies system events sent over WebSocket alongside telemetry.
type EventType string

const (
	EventTelemetry       EventType = "telemetry"
	EventDroneFault      EventType = "drone_fault"
	EventZoneReassigned  EventType = "zone_reassigned"
	EventMissionComplete EventType = "mission_complete"
	EventMissionStarted  EventType = "mission_started"
)

// WSMessage is the envelope for every WebSocket message sent to clients.
type WSMessage struct {
	Type    EventType   `json:"type"`
	Payload interface{} `json:"payload"`
}

// FaultEvent is the payload for EventDroneFault messages.
type FaultEvent struct {
	DroneID   string    `json:"drone_id"`
	DroneName string    `json:"drone_name"`
	Reason    string    `json:"reason"`
	At        time.Time `json:"at"`
}

// ReassignEvent is the payload for EventZoneReassigned messages.
type ReassignEvent struct {
	FaultedDroneID     string    `json:"faulted_drone_id"`
	ReplacementDroneID string    `json:"replacement_drone_id"`
	ZoneID             string    `json:"zone_id"`
	At                 time.Time `json:"at"`
}
