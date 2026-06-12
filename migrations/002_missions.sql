-- ─── Mission status enum ──────────────────────────────────────
CREATE TYPE mission_status AS ENUM (
    'pending',
    'planning',
    'active',
    'completed',
    'aborted',
    'fault'
);

-- ─── Missions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS missions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(128) NOT NULL,
    created_by      UUID NOT NULL REFERENCES operators(id),
    status          mission_status NOT NULL DEFAULT 'pending',

    -- Zone polygon stored as GeoJSON array of [lng, lat] pairs
    zone_geojson    JSONB NOT NULL,

    -- Altitude and speed settings
    altitude_m      FLOAT NOT NULL DEFAULT 10.0,
    airspeed_ms     FLOAT NOT NULL DEFAULT 5.0,

    -- AI planner output — array of zone assignments per drone
    plan_geojson    JSONB,

    -- Timing
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Mission drone assignments ────────────────────────────────
-- Each row maps one drone to one sub-zone within a mission.
CREATE TABLE IF NOT EXISTS mission_assignments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id  UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    drone_id    UUID NOT NULL REFERENCES drones(id),
    zone_id     VARCHAR(64) NOT NULL,         -- e.g. "zone-0", "zone-1"
    status      VARCHAR(32) NOT NULL DEFAULT 'assigned',  -- assigned | flying | complete | reassigned
    waypoints   JSONB NOT NULL,               -- array of {lat, lng, alt} waypoints from planner
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_created_by ON missions(created_by);
CREATE INDEX IF NOT EXISTS idx_assignments_mission ON mission_assignments(mission_id);
CREATE INDEX IF NOT EXISTS idx_assignments_drone ON mission_assignments(drone_id);