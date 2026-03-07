-- Migration 002: Update enums for user_role (user/admin only), audit ops, event status, add resource_type
-- Run after schema.sql on existing DB: psql -f 002_enum_and_audit_updates.sql
-- For fresh DB, schema.sql has everything; this is for existing installations.

BEGIN;

-- 1. user_role_enum: remove organizer, keep user/admin
UPDATE users SET role = 'user' WHERE role::text = 'organizer';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
    ALTER TABLE users ALTER COLUMN role TYPE varchar(20);
    DROP TYPE user_role_enum;
    CREATE TYPE user_role_enum AS ENUM ('user', 'admin');
    ALTER TABLE users ALTER COLUMN role TYPE user_role_enum USING (role::text)::user_role_enum;
  END IF;
END $$;

-- 2. audit_operation_enum: add new values (book, cancel already exist)
DO $$ BEGIN ALTER TYPE audit_operation_enum ADD VALUE 'create'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE audit_operation_enum ADD VALUE 'update'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE audit_operation_enum ADD VALUE 'delete'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE audit_operation_enum ADD VALUE 'fetch'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE audit_operation_enum ADD VALUE 'join_waitlist'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE audit_operation_enum ADD VALUE 'leave_waitlist'; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. audit_resource_enum: create if not exists
DO $$ BEGIN
  CREATE TYPE audit_resource_enum AS ENUM ('event', 'booking', 'user', 'waitlist');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 4. event_status_enum: add coming_soon
DO $$ BEGIN ALTER TYPE event_status_enum ADD VALUE 'coming_soon'; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 5. audit_log deprecated (migration 006 drops it); skip altering

COMMIT;
