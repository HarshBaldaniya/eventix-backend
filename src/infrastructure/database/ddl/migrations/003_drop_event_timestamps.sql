-- Migration 003: Drop event_start_at, event_end_at, booking_opens_at, booking_closes_at from events
-- Run on existing DB: psql -f 003_drop_event_timestamps.sql

BEGIN;

ALTER TABLE events DROP COLUMN IF EXISTS event_start_at;
ALTER TABLE events DROP COLUMN IF EXISTS event_end_at;
ALTER TABLE events DROP COLUMN IF EXISTS booking_opens_at;
ALTER TABLE events DROP COLUMN IF EXISTS booking_closes_at;

COMMIT;
