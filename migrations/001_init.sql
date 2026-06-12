-- ─── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ─── Operators (users who log in to the ground station) ───────
CREATE TABLE IF NOT EXISTS operators (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username    VARCHAR(64) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,      -- bcrypt hash
    role        VARCHAR(32) NOT NULL DEFAULT 'operator', -- operator | admin
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Drones (fleet registry) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS drones (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(64) UNIQUE NOT NULL,
    sitl_port       INTEGER NOT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'idle', -- idle | armed | flying | fault | rtl
    battery_pct     INTEGER NOT NULL DEFAULT 100,
    last_seen_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Seed default operator ────────────────────────────────────
-- Password: skymind123 (bcrypt hash — change in production)
INSERT INTO operators (username, password, role)
VALUES (
    'admin',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHuu',
    'admin'
) ON CONFLICT (username) DO NOTHING;

-- ─── Seed 5 drones matching SITL_DRONE_COUNT ──────────────────
INSERT INTO drones (name, sitl_port) VALUES
    ('Alpha',   5760),
    ('Bravo',   5770),
    ('Charlie', 5780),
    ('Delta',   5790),
    ('Echo',    5800)
ON CONFLICT (name) DO NOTHING;