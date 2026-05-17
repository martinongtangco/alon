// Minimal M1 schema — no PostGIS, no admin/audit, no businesses/events/promos.
// Use this for cloud Postgres where PostGIS isn't available (e.g. Railway).
// Usage: DATABASE_URL=<url> node scripts/db-init-minimal.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : undefined,
});

const SQL = `
CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name    VARCHAR(100),
    internal_token  VARCHAR(255) UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
    email           VARCHAR(255) UNIQUE,
    password_hash   VARCHAR(255),
    photo_url       TEXT,
    bio             VARCHAR(500),
    ghost_mode      BOOLEAN NOT NULL DEFAULT false,
    current_mode    VARCHAR(20) NOT NULL DEFAULT 'Networking',
    vibes           JSONB NOT NULL DEFAULT '[]',
    plan            VARCHAR(20) NOT NULL DEFAULT 'Free',
    phone           TEXT UNIQUE,
    phone_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    status          VARCHAR(20) NOT NULL DEFAULT 'Active',
    platform        VARCHAR(10),
    push_token      TEXT,
    suspended_until TIMESTAMPTZ,
    banned_at       TIMESTAMPTZ,
    last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.buzz_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id       UUID NOT NULL REFERENCES app.users(id),
    recipient_id    UUID NOT NULL REFERENCES app.users(id),
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_no_self_buzz CHECK (sender_id <> recipient_id)
);

CREATE TABLE IF NOT EXISTS app.reveal_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    initiator_id    UUID NOT NULL REFERENCES app.users(id),
    recipient_id    UUID NOT NULL REFERENCES app.users(id),
    mutual          BOOLEAN NOT NULL DEFAULT false,
    mutual_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_no_self_reveal CHECK (initiator_id <> recipient_id)
);

CREATE TABLE IF NOT EXISTS app.matches (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_a   UUID NOT NULL REFERENCES app.users(id),
    device_b   UUID NOT NULL REFERENCES app.users(id),
    status     TEXT NOT NULL DEFAULT 'mutual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(device_a, device_b)
);

CREATE INDEX IF NOT EXISTS idx_users_status      ON app.users(status);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON app.users(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_buzz_sender       ON app.buzz_events(sender_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_status    ON app.matches(status);
`;

async function run() {
  const client = await pool.connect();
  try {
    console.log('Initializing minimal M1 schema...');
    await client.query(SQL);
    console.log('✓ app schema + tables created');
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
