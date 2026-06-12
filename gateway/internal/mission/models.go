package mission

import "time"

// Status mirrors the mission_status DB enum.
type Status string

const (
	StatusPending   Status = "pending"
	StatusPlanning  Status = "planning"
	StatusActive    Status = "active"
	StatusCompleted Status = "completed"
	StatusAborted   Status = "aborted"
	StatusFault     Status = "fault"
)

// Mission is the core domain object representing a drone fleet mission.
type Mission struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	CreatedBy   string      `json:"created_by"`
	Status      Status      `json:"status"`
	ZoneGeoJSON [][]float64 `json:"zone_geojson"` // polygon: [[lng,lat], ...]
	AltitudeM   float64     `json:"altitude_m"`
	AirspeedMS  float64     `json:"airspeed_ms"`
	PlanGeoJSON interface{} `json:"plan_geojson,omitempty"`
	StartedAt   *time.Time  `json:"started_at,omitempty"`
	CompletedAt *time.Time  `json:"completed_at,omitempty"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

// Assignment maps a drone to a sub-zone within a mission.
type Assignment struct {
	ID        string      `json:"id"`
	MissionID string      `json:"mission_id"`
	DroneID   string      `json:"drone_id"`
	ZoneID    string      `json:"zone_id"`
	Status    string      `json:"status"`
	Waypoints interface{} `json:"waypoints"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
}

// CreateMissionRequest is the JSON body for POST /api/missions.
type CreateMissionRequest struct {
	Name        string      `json:"name"`
	ZoneGeoJSON [][]float64 `json:"zone_geojson"`
	AltitudeM   float64     `json:"altitude_m"`
	AirspeedMS  float64     `json:"airspeed_ms"`
}

// UpdateStatusRequest is the JSON body for PATCH /api/missions/:id/status.
type UpdateStatusRequest struct {
	Status Status `json:"status"`
}

// PlanResult is what the Python planner returns via gRPC (used in Phase 4+).
type PlanResult struct {
	Zones []ZonePlan `json:"zones"`
}

// ZonePlan holds one drone's assigned sub-zone and waypoints.
type ZonePlan struct {
	ZoneID    string     `json:"zone_id"`
	DroneID   string     `json:"drone_id"`
	Waypoints []Waypoint `json:"waypoints"`
}

// Waypoint is a single GPS coordinate in a planned path.
type Waypoint struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
	Alt float64 `json:"alt"`
}
