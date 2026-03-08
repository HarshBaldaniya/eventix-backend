# Database Schema

> PostgreSQL database schema for Eventix — 7 tables, 7 custom ENUM types, optimized indexes for concurrent booking workloads.

---

## Table of Contents

- [Entity-Relationship Overview](#entity-relationship-overview)
- [Custom ENUM Types](#custom-enum-types)
- [Tables](#tables)
  - [users](#users)
  - [sessions](#sessions)
  - [events](#events)
  - [bookings](#bookings)
  - [event_booking_config](#event_booking_config)
  - [event_audit_log](#event_audit_log)
  - [booking_audit_log](#booking_audit_log)
- [Index Strategy](#index-strategy)
- [Database Setup](#database-setup)

---

## Entity-Relationship Overview

```
┌──────────┐     1:N     ┌──────────┐
│  users   │────────────▶│ sessions │
│          │             └──────────┘
│          │     1:N     ┌──────────┐     N:1     ┌──────────┐
│          │────────────▶│ bookings │◀────────────│  events  │
└──────────┘             └──────────┘             └──────────┘
     │                        │                        │
     │                        │                        │
     ▼ 1:N                    ▼ 1:1                    ▼ 1:N
┌──────────────────┐  ┌─────────────────────┐  ┌──────────────────┐
│ event_audit_log  │  │ booking_audit_log   │  │event_booking_conf│
└──────────────────┘  └─────────────────────┘  └──────────────────┘
```

**Relationships:**
- A **user** has many **sessions** (login sessions)
- A **user** has many **bookings**
- An **event** has many **bookings**
- An **event** has one optional **event_booking_config** (per-event override)
- **event_audit_log** tracks event operations (create, update)
- **booking_audit_log** tracks booking operations (book, cancel)

---

## Custom ENUM Types

| ENUM | Values | Used By |
|------|--------|---------|
| `user_role_enum` | `user`, `admin` | `users.role` |
| `event_status_enum` | `draft`, `coming_soon`, `published`, `cancelled`, `completed` | `events.status` |
| `booking_status_enum` | `confirmed`, `cancelled` | `bookings.status` |
| `session_status_enum` | `active`, `inactive` | `sessions.status` |
| `audit_operation_enum` | `create`, `update`, `delete`, `fetch`, `book`, `cancel` | audit logs |
| `audit_resource_enum` | `event`, `booking` | audit logs |
| `audit_outcome_enum` | `success`, `failure` | audit logs |

---

## Tables

### users

Core user table with role-based enum.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `SERIAL` | PRIMARY KEY | auto |
| `email` | `VARCHAR(255)` | NOT NULL, UNIQUE | — |
| `password_hash` | `VARCHAR(255)` | NOT NULL | — |
| `name` | `VARCHAR(255)` | — | NULL |
| `role` | `user_role_enum` | NOT NULL | `'user'` |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` |

### sessions

Tracks login sessions for refresh token management. Supports soft-delete via status change.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `SERIAL` | PRIMARY KEY | auto |
| `user_id` | `INTEGER` | NOT NULL, FK → `users(id)` CASCADE | — |
| `refresh_token_hash` | `VARCHAR(255)` | NOT NULL | — |
| `status` | `session_status_enum` | NOT NULL | `'active'` |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` |

### events

Events with capacity tracking. `booked_count` is atomically maintained via transactions.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `SERIAL` | PRIMARY KEY | auto |
| `name` | `VARCHAR(255)` | NOT NULL | — |
| `description` | `TEXT` | — | NULL |
| `capacity` | `INTEGER` | NOT NULL, CHECK > 0 | — |
| `booked_count` | `INTEGER` | NOT NULL, CHECK ≥ 0 | `0` |
| `status` | `event_status_enum` | NOT NULL | `'draft'` |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` |

**Table constraint:** `CHECK (booked_count <= capacity)` — database-level overbooking prevention.

### bookings

Individual booking records with ticket count (multi-ticket support like movie/cricket bookings).

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `SERIAL` | PRIMARY KEY | auto |
| `event_id` | `INTEGER` | NOT NULL, FK → `events(id)` CASCADE | — |
| `user_id` | `INTEGER` | NOT NULL, FK → `users(id)` CASCADE | — |
| `ticket_count` | `INTEGER` | NOT NULL, CHECK > 0 | `1` |
| `status` | `booking_status_enum` | NOT NULL | `'confirmed'` |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` |

### event_booking_config

Configurable booking limits — global defaults (event_id = NULL) with per-event overrides.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `SERIAL` | PRIMARY KEY | auto |
| `event_id` | `INTEGER` | FK → `events(id)` CASCADE, NULLABLE | NULL |
| `max_tickets_per_booking` | `INTEGER` | NOT NULL, CHECK > 0 | — |
| `max_tickets_per_user` | `INTEGER` | NOT NULL, CHECK > 0 | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` |

**Default config:** `max_tickets_per_booking = 6`, `max_tickets_per_user = 15`

**Override pattern:** Insert a row with a specific `event_id` to override defaults for that event. The service queries per-event config first, falling back to the global default (where `event_id IS NULL`).

### event_audit_log

Tracks event lifecycle operations (create, update).

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `SERIAL` | PRIMARY KEY | auto |
| `operation` | `audit_operation_enum` | NOT NULL | — |
| `event_id` | `INTEGER` | NOT NULL, FK → `events(id)` CASCADE | — |
| `user_id` | `INTEGER` | FK → `users(id)` SET NULL | NULL |
| `outcome` | `audit_outcome_enum` | NOT NULL | — |
| `details` | `JSONB` | — | NULL |
| `error_code` | `VARCHAR(32)` | — | NULL |
| `error_message` | `TEXT` | — | NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` |

### booking_audit_log

Tracks booking operations (book, cancel) with ticket-level detail.

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `SERIAL` | PRIMARY KEY | auto |
| `operation` | `audit_operation_enum` | NOT NULL | — |
| `event_id` | `INTEGER` | NOT NULL, FK → `events(id)` CASCADE | — |
| `booking_id` | `INTEGER` | FK → `bookings(id)` SET NULL | NULL |
| `user_id` | `INTEGER` | FK → `users(id)` SET NULL | NULL |
| `ticket_count` | `INTEGER` | — | NULL |
| `outcome` | `audit_outcome_enum` | NOT NULL | — |
| `details` | `JSONB` | — | NULL |
| `error_code` | `VARCHAR(32)` | — | NULL |
| `error_message` | `TEXT` | — | NULL |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` |

---

## Index Strategy

| Index | Table | Column(s) | Type | Rationale |
|-------|-------|-----------|------|-----------|
| `idx_sessions_user_id` | sessions | `user_id` | B-tree | Fast session lookup by user |
| `idx_sessions_expires_at` | sessions | `expires_at` | B-tree | Cleanup expired sessions |
| `idx_sessions_status` | sessions | `status` | B-tree | Filter active/inactive |
| `idx_sessions_active_token` | sessions | `refresh_token_hash` | Unique partial (`status='active'`) | Enforce one active session per token |
| `idx_events_created_at` | events | `created_at DESC` | B-tree | Pagination by recency |
| `idx_bookings_event_user_status` | bookings | `(event_id, user_id)` | Partial (`status='confirmed'`) | Per-user ticket limit checks |
| `idx_bookings_user_id` | bookings | `user_id` | B-tree | "My bookings" queries |
| `idx_bookings_event_id` | bookings | `event_id` | B-tree | Event's bookings lookup |
| `idx_bookings_status` | bookings | `status` | B-tree | Filter confirmed/cancelled |
| `idx_event_audit_log_event_id` | event_audit_log | `(event_id, created_at DESC)` | B-tree | Audit trail per event |
| `idx_event_audit_log_outcome` | event_audit_log | `(outcome, created_at DESC)` | B-tree | Filter by success/failure |
| `idx_booking_audit_log_event_id` | booking_audit_log | `(event_id, created_at DESC)` | B-tree | Audit trail per event |
| `idx_booking_audit_log_booking_id` | booking_audit_log | `(booking_id, created_at DESC)` | B-tree | Audit trail per booking |
| `idx_booking_audit_log_outcome` | booking_audit_log | `(outcome, created_at DESC)` | B-tree | Filter by success/failure |
| `idx_event_booking_config_event` | event_booking_config | `event_id` | Unique partial (`event_id IS NOT NULL`) | One config per event |
| `idx_event_booking_config_default` | event_booking_config | `(1)` | Unique partial (`event_id IS NULL`) | Exactly one global default |

---

## Database Setup

### Initialize Database & Schema

```bash
npm run db:init
```

This runs `scripts/db-init.ts` which:
1. Connects to the `postgres` default database
2. Creates the `eventix` database (skips if exists)
3. Runs `src/infrastructure/database/ddl/schema.sql` (creates all tables, types, indexes)

### Seed Data

```bash
npm run db:seed
```

Creates seed data:

| Type | Email | Password | Role |
|------|-------|----------|------|
| Admin | `admin@eventix.com` | `Admin@123` | `admin` |
| User | `user@eventix.com` | `User@123` | `user` |

Plus **15 events** with varying statuses (`draft`, `coming_soon`, `published`) and capacities (25–300).

### Remove Seed Data

```bash
npm run db:seed:down
```

Runs `src/infrastructure/database/ddl/seed-down.sql` to remove all seed data.

### Stress Test Seeding

```bash
npm run db:seed-stress
```

Seeds **50,000 users** for stress test scenarios.

---

> **Source:** [`src/infrastructure/database/ddl/schema.sql`](../src/infrastructure/database/ddl/schema.sql)

---

<p align="center">
  <a href="https://www.linkedin.com/in/hb134/">LinkedIn</a> •
  <a href="https://harshbaldaniya.com">Portfolio</a>
</p>
