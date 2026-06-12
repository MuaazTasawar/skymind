package mavlink

import (
	"sync"
	"time"
)

// DroneStatus represents the current operational state of a drone.
type DroneStatus string

const (
	StatusIdle    DroneStatus = "idle"
	StatusArmed   DroneStatus = "armed"
	StatusFlying  DroneStatus = "flying"
	StatusFault   DroneStatus = "fault"
	StatusRTL     DroneStatus = "rtl"
	StatusLanding DroneStatus = "landing"
)

// DroneState holds the latest telemetry snapshot for a single drone.
// All fields are safe to read concurrently after acquiring the mu lock.
type DroneState struct {
	mu sync.RWMutex

	ID       string      `json:"id"`
	Name     string      `json:"name"`
	SITLPort int         `json:"sitl_port"`
	Status   DroneStatus `json:"status"`

	// Position
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
	Alt float64 `json:"alt_m"`

	// Attitude (degrees)
	Roll  float64 `json:"roll_deg"`
	Pitch float64 `json:"pitch_deg"`
	Yaw   float64 `json:"yaw_deg"`

	// Flight data
	Airspeed    float64 `json:"airspeed_ms"`
	Groundspeed float64 `json:"groundspeed_ms"`
	Heading     float64 `json:"heading_deg"`
	ClimbRate   float64 `json:"climb_rate_ms"`

	// Health
	BatteryPct  int     `json:"battery_pct"`
	BatteryVolt float64 `json:"battery_volt"`

	// Mission progress
	WaypointIndex int `json:"waypoint_index"`
	WaypointTotal int `json:"waypoint_total"`

	// Connectivity
	Armed         bool      `json:"armed"`
	GPSFix        bool      `json:"gps_fix"`
	LastHeartbeat time.Time `json:"last_heartbeat"`
	Connected     bool      `json:"connected"`

	// Fault tolerance
	AssignedZoneID string `json:"assigned_zone_id,omitempty"`
	MissionID      string `json:"mission_id,omitempty"`
}

// Snapshot returns a deep copy of the current drone state (safe for JSON serialisation).
func (d *DroneState) Snapshot() DroneState {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return DroneState{
		ID:             d.ID,
		Name:           d.Name,
		SITLPort:       d.SITLPort,
		Status:         d.Status,
		Lat:            d.Lat,
		Lng:            d.Lng,
		Alt:            d.Alt,
		Roll:           d.Roll,
		Pitch:          d.Pitch,
		Yaw:            d.Yaw,
		Airspeed:       d.Airspeed,
		Groundspeed:    d.Groundspeed,
		Heading:        d.Heading,
		ClimbRate:      d.ClimbRate,
		BatteryPct:     d.BatteryPct,
		BatteryVolt:    d.BatteryVolt,
		WaypointIndex:  d.WaypointIndex,
		WaypointTotal:  d.WaypointTotal,
		Armed:          d.Armed,
		GPSFix:         d.GPSFix,
		LastHeartbeat:  d.LastHeartbeat,
		Connected:      d.Connected,
		AssignedZoneID: d.AssignedZoneID,
		MissionID:      d.MissionID,
	}
}

// IsHeartbeatStale returns true if no heartbeat was received within the timeout.
func (d *DroneState) IsHeartbeatStale(timeout time.Duration) bool {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return time.Since(d.LastHeartbeat) > timeout
}

// SetFault marks the drone as faulted (thread-safe).
func (d *DroneState) SetFault() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.Status = StatusFault
	d.Connected = false
}
