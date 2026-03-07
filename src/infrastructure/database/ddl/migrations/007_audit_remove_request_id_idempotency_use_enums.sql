-- Migration 007: Remove request_id and idempotency_key from audit tables; use audit_operation_enum and audit_outcome_enum
-- Run: psql -U postgres -d eventix -f src/infrastructure/database/ddl/migrations/007_audit_remove_request_id_idempotency_use_enums.sql

BEGIN;

-- 1. Drop indexes that reference columns we are removing
DROP INDEX IF EXISTS idx_event_audit_log_request_id;
DROP INDEX IF EXISTS idx_event_audit_log_idempotency;
DROP INDEX IF EXISTS idx_booking_audit_log_request_id;
DROP INDEX IF EXISTS idx_booking_audit_log_idempotency;

-- 2. Drop request_id and idempotency_key columns
ALTER TABLE event_audit_log DROP COLUMN IF EXISTS request_id;
ALTER TABLE event_audit_log DROP COLUMN IF EXISTS idempotency_key;
ALTER TABLE booking_audit_log DROP COLUMN IF EXISTS request_id;
ALTER TABLE booking_audit_log DROP COLUMN IF EXISTS idempotency_key;

-- 3. Alter operation and outcome to use enums (existing VARCHAR values must be valid enum values)
ALTER TABLE event_audit_log
  ALTER COLUMN operation TYPE audit_operation_enum USING operation::audit_operation_enum,
  ALTER COLUMN outcome TYPE audit_outcome_enum USING outcome::audit_outcome_enum;

ALTER TABLE booking_audit_log
  ALTER COLUMN operation TYPE audit_operation_enum USING operation::audit_operation_enum,
  ALTER COLUMN outcome TYPE audit_outcome_enum USING outcome::audit_outcome_enum;

COMMIT;
