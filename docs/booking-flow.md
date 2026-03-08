# Booking Flow

> Complete documentation of the booking and cancellation lifecycle — from HTTP request to database commit, including Redis caching, transaction management, and audit logging.

---

## Table of Contents

- [Booking Request Lifecycle](#booking-request-lifecycle)
- [Step-by-Step Breakdown](#step-by-step-breakdown)
- [Ticket Limit Validation](#ticket-limit-validation)
- [Cancellation Flow](#cancellation-flow)
- [Redis Spot Caching](#redis-spot-caching)
- [Deadlock Retry Strategy](#deadlock-retry-strategy)
- [Error Scenarios](#error-scenarios)

---

## Booking Request Lifecycle

```
POST /api/v1/events/:eventId/bookings  { ticket_count: 2 }
  │
  ├─► Auth Middleware         → Verify JWT, extract user {id, role}
  ├─► Controller              → Validate input (Zod), extract eventId
  │
  ├─► BookingService.bookSpot()
  │     │
  │     ├─► 1. Redis Sync Check
  │     │     └── If key missing → load remaining_spots from DB → SETNX
  │     │
  │     ├─► 2. Redis DECRBY (atomic)
  │     │     ├── spots ≥ 0 → proceed to DB
  │     │     └── spots < 0 → self-heal or rollback + throw 409
  │     │
  │     ├─► 3. PostgreSQL Transaction
  │     │     ├── SELECT ... FOR UPDATE (lock event row)
  │     │     ├── Validate business rules
  │     │     │     ├── Event is published?
  │     │     │     ├── Enough spots remaining?
  │     │     │     ├── Within per-booking limit?
  │     │     │     └── Within per-user limit?
  │     │     ├── UPDATE events SET booked_count += ticket_count
  │     │     ├── INSERT INTO bookings
  │     │     └── INSERT INTO booking_audit_log (success)
  │     │
  │     └─► 4. On DB failure → Redis INCRBY (rollback spots)
  │
  └─► Response: 201 { booking }
```

---

## Step-by-Step Breakdown

### Step 1: Redis Sync Check (`ensureRedisSynced`)

Before any booking, the service checks if Redis has the event's spot counter:

```
Redis key: event:{eventId}:spots
```

- **Key exists** → skip (fast path)
- **Key missing** → query `events` table for `capacity - booked_count` → `SETNX` (set-if-not-exists)

This ensures Redis is initialized on first access without overwriting concurrent writes.

### Step 2: Redis Atomic Reservation

```typescript
spotsLeft = await redis.decrby(key, ticketCount);
```

- **`spotsLeft ≥ 0`** → reservation accepted, proceed to database
- **`spotsLeft < 0`** → two scenarios:
  - **Redis out of sync** → re-check DB, heal Redis if DB has spots
  - **Actually sold out** → rollback with `INCRBY`, throw `409 Sold Out`

### Step 3: PostgreSQL Transaction

Within a serializable transaction:

1. **`SELECT ... FOR UPDATE`** — locks the event row to prevent concurrent modifications
2. **Business rule validation** — published status, remaining spots, ticket limits
3. **`reserveSpots()`** — atomically increments `booked_count` with constraint check
4. **`INSERT booking`** — creates the booking record
5. **Audit log** — records success/failure with details

### Step 4: Failure Rollback

If the database transaction fails for **any reason**:

```typescript
await redis.incrby(redisKey, ticketCount); // return spots to Redis
```

This ensures Redis stays in sync even when database operations fail.

---

## Ticket Limit Validation

Two configurable limits from `event_booking_config`:

| Limit | Default | Purpose |
|-------|---------|---------|
| `max_tickets_per_booking` | 6 | Max tickets in a single booking request |
| `max_tickets_per_user` | 15 | Max total tickets per user across all bookings for one event |

**Validation flow:**

```
1. ticket_count > max_tickets_per_booking?  → 409 "Cannot book more than 6 tickets per booking"
2. (currentBooked + ticket_count) > max_tickets_per_user?  → 409 "You can book at most 15 tickets"
```

Per-event overrides: Insert a row in `event_booking_config` with a specific `event_id` to override defaults.

---

## Cancellation Flow

```
PATCH /api/v1/bookings/:bookingId  { status: "cancelled" }
  │
  ├─► Auth Middleware
  ├─► BookingService.cancelBooking()
  │     │
  │     ├─► PostgreSQL Transaction
  │     │     ├── SELECT booking FOR UPDATE (lock booking row)
  │     │     ├── Verify ownership (user's own or admin)
  │     │     ├── Check not already cancelled (→ 422)
  │     │     ├── SELECT event FOR UPDATE (lock event row)
  │     │     ├── UPDATE booking SET status = 'cancelled'
  │     │     ├── UPDATE event SET booked_count -= ticket_count
  │     │     └── Audit log (success)
  │     │
  │     └─► Redis INCRBY (return spots to cache)
  │
  └─► Response: 200 { booking }
```

**Key detail:** Both the booking row **and** the event row are locked (`FOR UPDATE`) to prevent race conditions during cancellation.

---

## Redis Spot Caching

Redis serves as a **high-speed write-ahead filter** for spot availability:

| Operation | Redis Command | Purpose |
|-----------|---------------|---------|
| Initialize | `SETNX event:{id}:spots {remaining}` | First-access sync from DB |
| Book | `DECRBY event:{id}:spots {count}` | Atomic spot reservation |
| Cancel | `INCRBY event:{id}:spots {count}` | Return spots on cancel |
| Rollback | `INCRBY event:{id}:spots {count}` | Return spots on DB failure |
| Self-heal | `SET event:{id}:spots {dbValue}` | Fix drift between Redis/DB |

> Redis is **not the source of truth** — PostgreSQL is. Redis filters out ~99.99% of requests before they hit the database, but the database transaction has final authority.

---

## Deadlock Retry Strategy

PostgreSQL deadlocks can occur when multiple transactions lock rows in different orders. The service handles this with automatic retry:

```
Attempts: 3
Delay: 50ms + random(0-100ms) jitter
Error code: 40P01 (PostgreSQL deadlock)
```

On each retry, the entire transaction is re-executed from scratch.

---

## Error Scenarios

| Error | HTTP Status | Error Code | Cause |
|-------|-------------|------------|-------|
| Event not found | 404 | `EVB404001` | Invalid event ID |
| Event sold out | 409 | `EVB409001` | No spots remaining |
| Not enough spots | 409 | `EVB409001` | Requested > available |
| Event not published | 409 | `EVB409006` | Status is not `published` |
| Per-booking limit exceeded | 409 | `EVB409004` | `ticket_count > max_tickets_per_booking` |
| Per-user limit exceeded | 409 | `EVB409005` | Total tickets > `max_tickets_per_user` |
| Already cancelled | 422 | `EVB422001` | Booking already in `cancelled` status |
| Not authorized | 401 | `EVB401001` | Missing or invalid JWT |
| Forbidden | 403 | `EVB403001` | Cancelling another user's booking |

---

> **Source:** [`src/application/services/booking.service.ts`](../src/application/services/booking.service.ts)

---

<p align="center">
  <a href="https://www.linkedin.com/in/hb134/">LinkedIn</a> •
  <a href="https://harshbaldaniya.com">Portfolio</a>
</p>
