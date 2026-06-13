-- ─── Telemetry logs ───────────────────────────────────────────
-- Stores periodic snapshots of drone telemetry during missions.
-- Used for mission replay and post-mission analytics.

CREATE TABLE IF NOT EXISTS telemetry_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id      UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    drone_id        UUID NOT NULL REFERENCES drones(id),
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Position
    lat             FLOAT NOT NULL DEFAULT 0,
    lng             FLOAT NOT NULL DEFAULT 0,
    alt_m           FLOAT NOT NULL DEFAULT 0,

    -- Attitude
    roll_deg        FLOAT NOT NULL DEFAULT 0,
    pitch_deg       FLOAT NOT NULL DEFAULT 0,
    yaw_deg         FLOAT NOT NULL DEFAULT 0,

    -- Flight data
    airspeed_ms     FLOAT NOT NULL DEFAULT 0,
    groundspeed_ms  FLOAT NOT NULL DEFAULT 0,
    heading_deg     FLOAT NOT NULL DEFAULT 0,
    climb_rate_ms   FLOAT NOT NULL DEFAULT 0,

    -- Health
    battery_pct     INTEGER NOT NULL DEFAULT 100,
    battery_volt    FLOAT NOT NULL DEFAULT 0,

    -- Status
    status          VARCHAR(32) NOT NULL DEFAULT 'flying',
    armed           BOOLEAN NOT NULL DEFAULT TRUE,
    waypoint_index  INTEGER NOT NULL DEFAULT 0
);

-- ─── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_telemetry_mission ON telemetry_logs(mission_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_drone   ON telemetry_logs(drone_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_time    ON telemetry_logs(recorded_at);

-- ─── Event log ────────────────────────────────────────────────
-- Stores all system events (faults, reassignments, status changes)
-- for mission audit trail and replay.

CREATE TABLE IF NOT EXISTS mission_events (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id  UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    event_type  VARCHAR(64) NOT NULL,   -- drone_fault | zone_reassigned | mission_started | etc.
    payload     JSONB NOT NULL DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_mission ON mission_events(mission_id);
CREATE INDEX IF NOT EXISTS idx_events_type    ON mission_events(event_type);