package mission

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/MuaazTasawar/skymind/gateway/internal/db"
)

// Create inserts a new mission record and returns the created Mission.
func Create(ctx context.Context, req CreateMissionRequest, operatorID string) (*Mission, error) {
	zoneJSON, err := json.Marshal(req.ZoneGeoJSON)
	if err != nil {
		return nil, fmt.Errorf("mission: marshal zone: %w", err)
	}

	alt := req.AltitudeM
	if alt == 0 {
		alt = 10.0
	}
	spd := req.AirspeedMS
	if spd == 0 {
		spd = 5.0
	}

	query := `
		INSERT INTO missions (name, created_by, zone_geojson, altitude_m, airspeed_ms)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, created_by, status, zone_geojson,
		          altitude_m, airspeed_ms, created_at, updated_at
	`

	row := db.Pool.QueryRow(ctx, query,
		req.Name, operatorID, string(zoneJSON), alt, spd,
	)

	return scanMission(row)
}

// GetByID fetches a single mission by UUID.
func GetByID(ctx context.Context, id string) (*Mission, error) {
	query := `
		SELECT id, name, created_by, status, zone_geojson,
		       altitude_m, airspeed_ms, plan_geojson,
		       started_at, completed_at, created_at, updated_at
		FROM missions
		WHERE id = $1
	`
	row := db.Pool.QueryRow(ctx, query, id)
	return scanMissionFull(row)
}

// List returns all missions ordered by creation date descending.
func List(ctx context.Context) ([]Mission, error) {
	query := `
		SELECT id, name, created_by, status, zone_geojson,
		       altitude_m, airspeed_ms, plan_geojson,
		       started_at, completed_at, created_at, updated_at
		FROM missions
		ORDER BY created_at DESC
	`

	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("mission: list: %w", err)
	}
	defer rows.Close()

	var missions []Mission
	for rows.Next() {
		m, err := scanMissionFullRow(rows)
		if err != nil {
			return nil, err
		}
		missions = append(missions, *m)
	}
	return missions, nil
}

// UpdateStatus updates a mission's status field and sets updated_at.
func UpdateStatus(ctx context.Context, id string, status Status) (*Mission, error) {
	now := time.Now().UTC()

	var setStarted string
	if status == StatusActive {
		setStarted = ", started_at = NOW()"
	}
	if status == StatusCompleted || status == StatusAborted {
		setStarted = ", completed_at = NOW()"
	}

	query := fmt.Sprintf(`
		UPDATE missions
		SET status = $1, updated_at = $2 %s
		WHERE id = $3
		RETURNING id, name, created_by, status, zone_geojson,
		          altitude_m, airspeed_ms, plan_geojson,
		          started_at, completed_at, created_at, updated_at
	`, setStarted)

	row := db.Pool.QueryRow(ctx, query, string(status), now, id)
	return scanMissionFull(row)
}

// SavePlan stores the planner's output JSON into the mission record.
func SavePlan(ctx context.Context, missionID string, plan interface{}) error {
	planJSON, err := json.Marshal(plan)
	if err != nil {
		return fmt.Errorf("mission: marshal plan: %w", err)
	}

	_, err = db.Pool.Exec(ctx,
		`UPDATE missions SET plan_geojson = $1, updated_at = NOW() WHERE id = $2`,
		string(planJSON), missionID,
	)
	return err
}

// CreateAssignment inserts a drone-to-zone assignment row.
func CreateAssignment(ctx context.Context, a Assignment) error {
	wpJSON, err := json.Marshal(a.Waypoints)
	if err != nil {
		return fmt.Errorf("mission: marshal waypoints: %w", err)
	}

	_, err = db.Pool.Exec(ctx,
		`INSERT INTO mission_assignments
		 (mission_id, drone_id, zone_id, waypoints)
		 VALUES ($1, $2, $3, $4)`,
		a.MissionID, a.DroneID, a.ZoneID, string(wpJSON),
	)
	return err
}

// GetAssignments returns all drone assignments for a mission.
func GetAssignments(ctx context.Context, missionID string) ([]Assignment, error) {
	rows, err := db.Pool.Query(ctx,
		`SELECT id, mission_id, drone_id, zone_id, status, waypoints, created_at, updated_at
		 FROM mission_assignments WHERE mission_id = $1 ORDER BY zone_id`,
		missionID,
	)
	if err != nil {
		return nil, fmt.Errorf("mission: get assignments: %w", err)
	}
	defer rows.Close()

	var assignments []Assignment
	for rows.Next() {
		var a Assignment
		var wpRaw []byte
		err := rows.Scan(
			&a.ID, &a.MissionID, &a.DroneID, &a.ZoneID,
			&a.Status, &wpRaw, &a.CreatedAt, &a.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("mission: scan assignment: %w", err)
		}
		_ = json.Unmarshal(wpRaw, &a.Waypoints)
		assignments = append(assignments, a)
	}
	return assignments, nil
}

// UpdateAssignmentStatus updates a single assignment's status.
func UpdateAssignmentStatus(ctx context.Context, missionID, droneID, status string) error {
	_, err := db.Pool.Exec(ctx,
		`UPDATE mission_assignments
		 SET status = $1, updated_at = NOW()
		 WHERE mission_id = $2 AND drone_id = $3`,
		status, missionID, droneID,
	)
	return err
}

// ── Internal scan helpers ─────────────────────────────────────────────────────

type scannable interface {
	Scan(dest ...interface{}) error
}

func scanMission(row scannable) (*Mission, error) {
	var m Mission
	var zoneRaw []byte
	err := row.Scan(
		&m.ID, &m.Name, &m.CreatedBy, &m.Status,
		&zoneRaw, &m.AltitudeM, &m.AirspeedMS,
		&m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("mission: scan: %w", err)
	}
	_ = json.Unmarshal(zoneRaw, &m.ZoneGeoJSON)
	return &m, nil
}

func scanMissionFull(row scannable) (*Mission, error) {
	var m Mission
	var zoneRaw []byte
	var planRaw []byte
	err := row.Scan(
		&m.ID, &m.Name, &m.CreatedBy, &m.Status,
		&zoneRaw, &m.AltitudeM, &m.AirspeedMS,
		&planRaw, &m.StartedAt, &m.CompletedAt,
		&m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("mission: scan full: %w", err)
	}
	_ = json.Unmarshal(zoneRaw, &m.ZoneGeoJSON)
	if planRaw != nil {
		_ = json.Unmarshal(planRaw, &m.PlanGeoJSON)
	}
	return &m, nil
}

type rowScanner interface {
	Scan(dest ...interface{}) error
}

func scanMissionFullRow(row rowScanner) (*Mission, error) {
	return scanMissionFull(row)
}
