-- ADR 0034: Add radius_m column to app.events
-- Allows events to have a broadcast radius like promos
ALTER TABLE app.events ADD COLUMN IF NOT EXISTS radius_m INTEGER;