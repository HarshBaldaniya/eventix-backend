-- Migration 008: Drop waitlist table
-- Run: psql -U postgres -d eventix -f src/infrastructure/database/ddl/migrations/008_drop_waitlist.sql

BEGIN;
DROP TABLE IF EXISTS waitlist CASCADE;
COMMIT;
