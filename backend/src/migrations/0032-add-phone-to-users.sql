-- ADR 0032: M2 User Account Model — Add phone columns to app.users
-- Date: 2026-05-14

ALTER TABLE app.users
  ADD COLUMN IF NOT EXISTS phone        TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;