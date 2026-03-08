# Booking Concurrency Problem & Solution

> How Eventix handles the classic **"50,000 users booking 5 spots"** race condition — the problem, the chosen approach, alternative strategies, and future improvements.

---

## Table of Contents

- [The Problem](#the-problem)
- [Why It's Hard](#why-its-hard)
- [Our Solution: Two-Layer Defense](#our-solution-two-layer-defense)
- [How It Works In Practice](#how-it-works-in-practice)
- [Self-Healing Redis](#self-healing-redis)
- [Results: Stress Test Proof](#results-stress-test-proof)
- [Alternative Approaches & Trade-offs](#alternative-approaches--trade-offs)
- [Why We Chose This Approach](#why-we-chose-this-approach)
- [Known Limitations](#known-limitations)
- [Future Improvements](#future-improvements)

---

## The Problem

**Scenario:** An event has 5 spots. 50,000 users click "Book Now" simultaneously.

A **naive implementation** would:

```
1. SELECT remaining_spots FROM events WHERE id = 1      → returns 5
2. IF remaining_spots > 0 THEN
3.   INSERT INTO bookings(event_id, user_id)
4.   UPDATE events SET booked_count = booked_count + 1
```

**The race condition:** Between step 1 (read) and step 4 (write), hundreds of other requests also read `remaining_spots = 5` and proceed. Result: **hundreds of bookings for 5 spots** — catastrophic overbooking.

---

## Why It's Hard

| Challenge | Description |
|-----------|-------------|
| **Check-then-act** | The gap between reading availability and writing the booking creates a race window |
| **Database throughput** | PostgreSQL can handle ~500 transactions/sec with row locks — not enough for 50K concurrent requests |
| **Deadlocks** | Multiple transactions locking the same rows in different orders cause PostgreSQL deadlocks (`40P01`) |
| **Memory pressure** | Holding 50K database connections or transactions simultaneously exhausts connection pools |
| **Consistency** | Must guarantee exactly N bookings for N spots — no overbooking, no underbooking |

---

## Our Solution: Two-Layer Defense

```
                            50,000 requests
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                             │
              ┌───────────┐                       │
              │   REDIS   │  Layer 1: Speed       │
              │  DECRBY   │  (Atomic Filter)      │
              └─────┬─────┘                       │
                    │                             │
            ┌───────┴───────┐                     │
            ▼               ▼                     │
        spots ≥ 0      spots < 0                  │
        (≈5 pass)      (49,995 rejected)          │
            │               │                     │
            ▼               ▼                     │
     ┌──────────┐     409 Conflict                 │
     │ POSTGRES │     (instant)                   │
     │  SELECT  │                                 │
     │   FOR    │  Layer 2: Truth                  │
     │  UPDATE  │  (Serialized DB)                │
     └──────────┘                                 │
            │                                     │
       5 bookings                                 │
       confirmed                                  │
                                                  │
                    Total time: ~21-45 seconds     │
                    ──────────────────────────────┘
```

### Layer 1: Redis Atomic Filter (Speed)

```typescript
const spotsLeft = await redis.decrby(`event:${eventId}:spots`, ticketCount);
```

- **`DECRBY` is atomic** — no race condition possible at the Redis level
- Handles ~100,000+ operations/second (single thread, in-memory)
- Filters out 49,995 requests **before they ever touch PostgreSQL**
- If `spotsLeft < 0` → instant `409 Conflict` (no DB work needed)

### Layer 2: PostgreSQL Transaction (Truth)

```sql
BEGIN;
  SELECT * FROM events WHERE id = $1 FOR UPDATE;    -- Lock the row
  -- Validate business rules (published, limits, etc.)
  UPDATE events SET booked_count = booked_count + $2
    WHERE id = $1 AND booked_count + $2 <= capacity;  -- Atomic increment
  INSERT INTO bookings (event_id, user_id, ticket_count) VALUES ($1, $2, $3);
COMMIT;
```

- Only ~5 requests reach this layer (the ones that passed Redis)
- `SELECT ... FOR UPDATE` serializes access to the event row
- Database constraint `CHECK (booked_count <= capacity)` is the **ultimate guardrail**
- If transaction fails → Redis spots are rolled back via `INCRBY`

---

## How It Works In Practice

| Stage | Requests | Response | Time |
|-------|----------|----------|------|
| Redis DECRBY | 50,000 | 5 pass, 49,995 get 409 | ~20ms per batch of 100 |
| PG Transaction | ~5 | 5 get 201, 0 fail | ~50ms |
| **Total** | 50,000 | **5 × 201, 49,995 × 409** | **~21-45 seconds** |

---

## Self-Healing Redis

Redis can drift out of sync with PostgreSQL (e.g., after server restart, Redis flush, or network partition). The service handles this automatically:

```
1. Redis DECRBY returns spotsLeft < 0 (Redis thinks sold out)
2. Query PostgreSQL: SELECT remaining_spots
3. If DB says spots available:
   → SET redis_key = (db_remaining - ticket_count)  ← Heals Redis
   → Proceed with booking
4. If DB confirms sold out:
   → INCRBY (rollback Redis)
   → Return 409
```

This makes Redis a **best-effort cache** — it never blocks valid bookings even when stale.

---

## Results: Stress Test Proof

All stress tests pass with **zero overbookings**:

| Test | Users | Spots | Bookings | Conflicts | Time |
|------|-------|-------|----------|-----------|------|
| Full-Auth (50 users) | 50 | 5 | 5 ✅ | 45 | 2.44s |
| Mega-Auth In-Process (50K) | 50,000 | 5 | 5 ✅ | 49,988 | 28.71s |
| Mega-Auth Real HTTP (50K) | 50,000 | 5 | 5 ✅ | 49,995 | 21.15s |
| Bypass-Auth (50K) | 50,000 | 5 | 5 ✅ | 49,987 | 45.74s |

> DB Final Count always matches Bookings Completed — **zero overbooking guaranteed**.

---

## Alternative Approaches & Trade-offs

| Approach | How It Works | Pros | Cons |
|----------|-------------|------|------|
| **DB-Only Locking** (`SELECT FOR UPDATE`) | All 50K requests hit PostgreSQL | Simple, single source of truth | ~500 req/s, deadlocks, pool exhaustion |
| **Optimistic Locking** (version column) | Read version → write with WHERE version = X | Good for low contention | High retry storms at 50K scale, wasted work |
| **Redis + PG** (our approach) | Redis atomic filter → PG serialized truth | 100K+ req/s filter, correctness guaranteed | Two systems to maintain, Redis sync edge cases |
| **Message Queue** (Kafka/RabbitMQ) | Enqueue all requests, process sequentially | Perfect ordering, no races | Added infra, latency, eventual consistency |
| **Distributed Lock** (Redlock) | Acquire lock across Redis nodes before booking | Strong consistency across nodes | Complex, slower than atomic ops, clock sync issues |
| **Lua Script** (Redis) | Single Lua script for check+decrement | Truly atomic multi-key ops | Limited to Redis data, still need DB commit |

---

## Why We Chose This Approach

1. **Performance**: Redis filters 99.99% of requests at ~100K ops/sec — only 5 requests actually touch PostgreSQL
2. **Correctness**: PostgreSQL's `SELECT FOR UPDATE` + `CHECK` constraint is the **mathematical guarantee** against overbooking
3. **Simplicity**: No additional infrastructure (no Kafka, no Redlock cluster) — just Redis (already used for caching) + PostgreSQL (already the primary DB)
4. **Resilience**: Self-healing Redis sync handles cache-DB drift automatically
5. **Proven**: All stress tests (50K users, 5 spots) pass with zero overbooking

---

## Known Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Single Redis instance | If Redis goes down, all requests hit PostgreSQL directly | Self-healing re-initializes on recovery |
| Redis-DB drift window | Brief period where Redis and DB disagree | Self-healing corrects on next request |
| Deadlock retries | 3 retries with 50ms+ delay | Exponential jitter prevents thundering herd |
| Connection pool size | Default 20 connections limits concurrent DB ops | Configurable via `DB_POOL_MAX` env variable |

---

## Future Improvements

| Improvement | Benefit |
|-------------|---------|
| **Redis Lua Scripts** | Multi-key atomic operations (check + decrement + validate in one call) |
| **Redis Cluster / Sentinel** | High availability, automatic failover |
| **Circuit Breaker** | Degrade gracefully when Redis/DB is under extreme load |
| **Event-Level Connection Pools** | Isolate hot events from cold ones |
| **Kafka Dead Letter Queue** | Capture failed bookings for retry/analysis |
| **Database Partitioning** | Partition bookings by event_id for horizontal scaling |
| **WebSocket Notifications** | Real-time spot count updates to frontend |

---

> **Source:** [`src/application/services/booking.service.ts`](../src/application/services/booking.service.ts)

---

<p align="center">
  <a href="https://www.linkedin.com/in/hb134/">LinkedIn</a> •
  <a href="https://harshbaldaniya.com">Portfolio</a>
</p>
