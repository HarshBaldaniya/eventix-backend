-- Migration 006: Drop legacy audit_log table; update event_booking_config defaults to 6/15
-- Run: psql -U postgres -d eventix -f src/infrastructure/database/ddl/migrations/006_drop_audit_log_and_booking_config_defaults.sql

BEGIN;

-- 1. Drop legacy audit_log table (replaced by event_audit_log + booking_audit_log)
DROP TABLE IF EXISTS audit_log CASCADE;

-- 2. Update default event_booking_config: max_tickets_per_booking=6 (per request), max_tickets_per_user=15 (total per event)
UPDATE event_booking_config
SET max_tickets_per_booking = 6, max_tickets_per_user = 15, updated_at = NOW()
WHERE event_id IS NULL;

COMMIT;
