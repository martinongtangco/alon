-- ADR 0035: M2 Age Verification Strategy — Add age columns to app.users
-- Date: 2026-06-24

ALTER TABLE app.users
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS age_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ;