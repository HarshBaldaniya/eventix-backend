-- Migration 003: Multi-ticket bookings + event_booking_config
-- Adds ticket_count to bookings, config table for max tickets per booking/user per event.
-- Run: psql -U postgres -d backend_db -f src/infrastructure/database/ddl/migrations/003_booking_config_and_ticket_count.sql

BEGIN;

-- 1. Add ticket_count to bookings (default 1 for existing rows)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ticket_count INTEGER NOT NULL DEFAULT 1 CHECK (ticket_count > 0);

-- 2. Create event_booking_config: default (event_id=NULL) + per-event overrides
CREATE TABLE IF NOT EXISTS event_booking_config (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  max_tickets_per_booking INTEGER NOT NULL CHECK (max_tickets_per_booking > 0),
  max_tickets_per_user INTEGER NOT NULL CHECK (max_tickets_per_user > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_booking_config_event ON event_booking_config (event_id) WHERE event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_booking_config_default ON event_booking_config ((1)) WHERE event_id IS NULL;

-- 3. Insert default config (event_id=NULL): max 6 per booking, 15 total per user per event
INSERT INTO event_booking_config (event_id, max_tickets_per_booking, max_tickets_per_user)
SELECT NULL, 6, 15
WHERE NOT EXISTS (SELECT 1 FROM event_booking_config WHERE event_id IS NULL);

-- 4. Drop old unique constraint: one user could only have one booking per event
-- Now we allow multiple bookings per user per event (up to max_tickets_per_user total)
DROP INDEX IF EXISTS idx_bookings_event_user_confirmed;

-- 5. Add index for summing user tickets per event (used in validation)
CREATE INDEX IF NOT EXISTS idx_bookings_event_user_status
  ON bookings (event_id, user_id) WHERE status = 'confirmed';

COMMIT;
