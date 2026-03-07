-- Migration 004: event_audit_log and booking_audit_log tables (production-grade audit for events and bookings)
-- Run on existing DB: psql -U postgres -d eventix -f src/infrastructure/database/ddl/migrations/004_event_and_booking_audit_tables.sql

BEGIN;

-- event_audit_log: create, update operations on events
CREATE TABLE IF NOT EXISTS event_audit_log (
  id SERIAL PRIMARY KEY,
  operation VARCHAR(32) NOT NULL,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  outcome VARCHAR(16) NOT NULL,
  request_id VARCHAR(64),
  details JSONB,
  error_code VARCHAR(32),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_audit_log_event_id ON event_audit_log(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_audit_log_request_id ON event_audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_event_audit_log_outcome ON event_audit_log(outcome, created_at DESC);

-- booking_audit_log: book, cancel operations on bookings
CREATE TABLE IF NOT EXISTS booking_audit_log (
  id SERIAL PRIMARY KEY,
  operation VARCHAR(32) NOT NULL,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ticket_count INTEGER,
  outcome VARCHAR(16) NOT NULL,
  request_id VARCHAR(64),
  details JSONB,
  error_code VARCHAR(32),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_booking_audit_log_event_id ON booking_audit_log(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_audit_log_booking_id ON booking_audit_log(booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_audit_log_request_id ON booking_audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_booking_audit_log_outcome ON booking_audit_log(outcome, created_at DESC);

COMMIT;
