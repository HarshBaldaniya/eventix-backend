-- Migration 005: Add idempotency_key to event_audit_log and booking_audit_log for retry-safe audit inserts
-- Run on existing DB: psql -U postgres -d eventix -f src/infrastructure/database/ddl/migrations/005_audit_idempotency_key.sql

BEGIN;

ALTER TABLE event_audit_log ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_audit_log_idempotency ON event_audit_log (idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE booking_audit_log ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_audit_log_idempotency ON booking_audit_log (idempotency_key) WHERE idempotency_key IS NOT NULL;

COMMIT;
