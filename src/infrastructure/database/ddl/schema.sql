CREATE DATABASE eventix;

-- Eventix schema: users, sessions, events, bookings, event_booking_config, event_audit_log, booking_audit_log

BEGIN;

-- ENUM types for type safety (user/admin only; event status with coming_soon; full audit ops)
DO $$ BEGIN
  CREATE TYPE user_role_enum AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE booking_status_enum AS ENUM ('confirmed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE audit_operation_enum AS ENUM ('create', 'update', 'delete', 'fetch', 'book', 'cancel');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE audit_resource_enum AS ENUM ('event', 'booking');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE audit_outcome_enum AS ENUM ('success', 'failure');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE event_status_enum AS ENUM ('draft', 'coming_soon', 'published', 'cancelled', 'completed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE session_status_enum AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Users (role via enum)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role user_role_enum NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Sessions for login/logout (refresh token storage; status: active/inactive for proper session lifecycle)
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(255) NOT NULL,
  status session_status_enum NOT NULL DEFAULT 'active',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_active_token ON sessions(refresh_token_hash) WHERE status = 'active';

-- Events (status via enum; no date columns - keep it simple)
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  booked_count INTEGER NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
  status event_status_enum NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_booked_lte_capacity CHECK (booked_count <= capacity)
);

-- Bookings (status via enum; ticket_count = tickets per booking, like movie/cricket tickets)
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket_count INTEGER NOT NULL DEFAULT 1 CHECK (ticket_count > 0),
  status booking_status_enum NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Event booking config: default (event_id=NULL) + per-event overrides for max tickets per booking/user
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
INSERT INTO event_booking_config (event_id, max_tickets_per_booking, max_tickets_per_user)
SELECT NULL, 6, 15
WHERE NOT EXISTS (SELECT 1 FROM event_booking_config WHERE event_id IS NULL);

-- event_audit_log: create, update operations on events (operation/outcome via enums)
CREATE TABLE IF NOT EXISTS event_audit_log (
  id SERIAL PRIMARY KEY,
  operation audit_operation_enum NOT NULL,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  outcome audit_outcome_enum NOT NULL,
  details JSONB,
  error_code VARCHAR(32),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_audit_log_event_id ON event_audit_log(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_audit_log_outcome ON event_audit_log(outcome, created_at DESC);

-- booking_audit_log: book, cancel operations on bookings (operation/outcome via enums)
CREATE TABLE IF NOT EXISTS booking_audit_log (
  id SERIAL PRIMARY KEY,
  operation audit_operation_enum NOT NULL,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ticket_count INTEGER,
  outcome audit_outcome_enum NOT NULL,
  details JSONB,
  error_code VARCHAR(32),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_booking_audit_log_event_id ON booking_audit_log(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_audit_log_booking_id ON booking_audit_log(booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_audit_log_outcome ON booking_audit_log(outcome, created_at DESC);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_event_user_status
  ON bookings (event_id, user_id) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_id ON bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

COMMIT;
