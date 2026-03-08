# Eventix Testing Guide

Complete guide to testing in the Eventix project: unit, integration, API, stress, and security tests.

---

## Table of Contents

1. [Standard Logic Tests (Vitest)](#1-standard-logic-tests-vitest)
2. [Stress Tests](#2-stress-tests)
3. [Mega-Auth: In-Process vs Real API](#3-mega-auth-in-process-vs-real-api)
4. [Rate-Limit Security Test](#4-rate-limit-security-test)
5. [Reporting](#5-reporting)
6. [Workflow & Commands](#6-workflow--commands)
7. [Request Flow & Concurrency](#7-request-flow--concurrency)
8. [Common Errors](#8-common-errors)
9. [Test Infrastructure](#9-test-infrastructure)

---

## 1. Standard Logic Tests (Vitest)

### Unit Tests
- **What**: Tests a single piece of code (e.g. a function) in isolation.
- **Example**: `BookingService` rejects when `ticket_count` (20) exceeds `max_tickets_per_booking` (6).
- **Why**: Ensures core rules are not broken when refactoring.
- **Run**: `npm run test:unit`

### Integration Tests
- **What**: Tests how code interacts with the real database.
- **Example**: `bookSpot()` creates a row in `bookings` and updates `events.booked_count`.
- **Why**: Validates SQL queries and data integrity.
- **Run**: `npm run test:integration`

### API Tests
- **What**: Full HTTP end-to-end flow.
- **Example**: POST `/api/v1/auth/login` returns a valid JWT.
- **Run**: `npm run test:api` or `npm run test:all`

---

## 2. Stress Tests

Stress tests simulate many users competing for a few spots to verify no overbooking and system stability.

### Test Types

| Test | Auth | Users | Purpose |
|------|------|-------|---------|
| **Full-Auth** | Real JWT | 50 | Register → Login → Book in one flow |
| **Bypass-Auth** | `x-test-user-id` header | 50,000 | Booking logic + Redis + DB under load |
| **Mega-Auth** | Real JWT | 50,000 | Full stack including JWT validation (in-process) |
| **Mega-Auth Real** | Real JWT | 50,000 | Same as Mega-Auth but hits real HTTP server |

### Full-Auth Stress Test (`test-booking-full-auth.ts`)
- **What**: 50 real users register, login, and book simultaneously.
- **Flow**: Create 50 users → 50 POST `/auth/register` + `/auth/login` → 50 POST `/events/:id/bookings`.
- **Why**: Proves auth flow and DB handle concurrent writes without deadlocks.
- **Run**: `npm run test:stress-full`

### Bypass-Auth Stress Test (`test-booking-bypass-auth.ts`)
- **What**: 50,000 users hit the booking API in batches of 100. Uses `x-test-user-id` header (no JWT).
- **Flow**:
  1. Create event with 5 spots.
  2. Fetch 50,000 pre-seeded users from DB.
  3. Send 50,000 POST requests with `x-test-user-id: <userId>`.
- **Why**: Tests Redis + DB under load without JWT overhead. Expects 5 × 201, 49,995 × 409.
- **Prerequisite**: `npm run db:seed-stress`
- **Run**: `npm run test:stress-bypass`

### Mega-Auth Stress Test (`test-booking-mega-auth.ts`)
- **What**: 50,000 fully authenticated users (real JWT) hit the booking API.
- **Flow**:
  1. Create event with 5 spots.
  2. Load 50,000 pre-generated JWTs from cache.
  3. Send 50,000 POST requests with `Authorization: Bearer <token>`.
- **Why**: Tests full stack (JWT verify + booking) at scale.
- **Prerequisites**: `npm run db:seed-stress`, `npm run test:tokens`
- **Run**: `npm run test:mega-auth`

### Mega-Auth Real API Test (`test-booking-mega-auth-real.ts`)
- **What**: Same as Mega-Auth but hits the **actual HTTP server** (e.g. `http://localhost:3000`). Simulates real users over the network.
- **Flow**:
  1. **Start the server first** (Terminal 1): `npm run dev` or `npm run start:test`
  2. Create event with 5 spots (via test script).
  3. Load 50,000 JWTs and send real HTTP POST requests to the server.
- **Why**: Tests how the real application behaves under load with real TCP/HTTP, not in-process supertest.
- **Prerequisites**: `npm run test:tokens`, server must be running
- **Run**: `npm run test:mega-auth:real`
- **Note**: If server runs with `NODE_ENV=dev`, rate limit (100 req/min) applies. Use `npm run start:test` to skip rate limit and test full booking flow.

### Batching Explained

Requests are **not** sent all at once. They are sent in batches:

- **Batch size**: 100 concurrent requests.
- **Process**: Batch 1 (100) → wait → Batch 2 (100) → wait → … → Batch 500 (100).
- **Why**: Avoids DB pool exhaustion and memory issues.

---

## 3. Mega-Auth: In-Process vs Real API

| Command | Mode | How it works |
|---------|------|---------------|
| `npm run test:mega-auth` | **In-process** | Supertest calls Express app directly. No HTTP. Fast, good for CI. |
| `npm run test:mega-auth:real` | **Real API** | Hits actual HTTP server. **Start server first.** Simulates real users. |

### Running Mega-Auth Real API

1. **Terminal 1** – Start the server:
   ```bash
   npm run dev
   # Or, to skip rate limiting: npm run start:test
   ```

2. **Terminal 2** – Run the stress test:
   ```bash
   npm run test:mega-auth:real
   ```

### Prerequisites for Real API

- Run `npm run test:tokens` first.
- Server must be running before the test.
- **Rate limiting**: If server runs with `NODE_ENV=dev`, rate limit (100 req/min) applies. Most requests may get **429**. To test full booking flow, run server with `npm run start:test`.

### Real API Results

| Result | Meaning |
|--------|---------|
| **Success (201)** | Booking created |
| **Conflict (409)** | Reached booking logic, spots full |
| **HTTP 429** | Rate limited – blocked before booking logic |
| **timeout** | Request took >30s; client gave up |

---

## 4. Rate-Limit Security Test

- **What**: Ensures the API blocks excessive requests.
- **Rule**: 100 requests per minute per IP.
- **Test**: Send 105 requests quickly.
- **Expected**: 1–100 succeed (200), 101–105 blocked (429).
- **Run**: `npm run test:rate-limit`

---

## 5. Reporting

| Output | Description |
|--------|-------------|
| `test-reports/TEST-REPORT.md` | Markdown summary of Vitest results |
| `test-reports/report.html` | HTML dashboard with stress & security metrics |
| `test-reports/custom-results.json` | Stress test metrics (duration, success/conflict counts) |

---

## 6. Workflow & Commands

### Full Stress Testing Workflow

1. **Rate limit**: `npm run test:rate-limit`
2. **Standard tests**: `npm run test:all`
3. **Full-auth (50 users)**: `npm run test:stress-full`
4. **Bypass (50k users)**:
   ```bash
   npm run db:seed-stress
   npm run test:stress-bypass
   ```
5. **Mega-auth (50k users, in-process)**:
   ```bash
   npm run test:tokens
   npm run test:mega-auth
   ```
6. **Mega-auth Real (50k users, real HTTP)** – Start server first, then:
   ```bash
   # Terminal 1
   npm run start:test
   # Terminal 2
   npm run test:mega-auth:real
   ```
7. **Report**: `npm run test:report` → open `test-reports/report.html`

### Command Cheat Sheet

| Command | Purpose |
|---------|---------|
| `npm run test:all` | All unit, integration, API tests |
| `npm run test:unit` | Unit tests only |
| `npm run test:integration` | Integration tests only |
| `npm run test:api` | API tests only |
| `npm run test:stress-full` | 50-user full flow (register → login → book) |
| `npm run test:stress-bypass` | 50k users, bypass auth |
| `npm run test:mega-auth` | 50k users, real JWT (in-process) |
| `npm run test:mega-auth:real` | 50k users, real JWT, real HTTP server |
| `npm run test:rate-limit` | Rate-limit security test |
| `npm run test:tokens` | Generate 50k JWTs for mega-auth |
| `npm run db:seed-stress` | Seed 50k users for stress tests |
| `npm run test:report` | Generate HTML & MD reports |

---

## 7. Request Flow & Concurrency

### Bypass-Auth Flow

```
Request → x-test-user-id header → Auth middleware (bypass) → Booking controller
         → Booking service
           → Redis: DECRBY event:X:spots (atomic)
           → If spots < 0: INCRBY (rollback), return 409
           → Else: DB transaction (INSERT booking, UPDATE event.booked_count)
           → On success: return 201
```

### Mega-Auth Flow

```
Request → Authorization: Bearer <JWT> → Auth middleware (verify JWT)
         → Extract user from token → Booking controller
         → [Same booking flow as above]
```

### Concurrency Control

1. **Redis** – Atomic `DECRBY` to reserve spots before DB.
2. **PostgreSQL** – Transaction with `SELECT ... FOR UPDATE` and `booked_count` check.
3. **409 Conflict** – Returned when Redis or DB detects no spots left.

### Log Explanation

```
[5000/50000] 30ms for last batch | ~2672 req/s elapsed
```
- `[5000/50000]` – 5,000 requests completed.
- `30ms for last batch` – Last batch of 100 took 30 ms.
- `~2672 req/s` – Average throughput (requests per second).

---

## 8. Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Only found 0 stress users` | Seeding not run | `npm run db:seed-stress` |
| `Token cache not found` | Tokens not generated | `npm run test:tokens` |
| `Event not found (404)` | DB not initialized | `npm run db:init` |
| `Redis connection error` | Redis not running | Start Redis on localhost:6379 |
| `HTTP 429` (Real API) | Rate limit on server | Run server with `npm run start:test` |
| `Rate limit not triggered` | Test header missing | Use provided test scripts |

---

## 9. Test Infrastructure

| Folder | Contents |
|--------|----------|
| `tests/unit/` | Isolated logic tests |
| `tests/integration/` | Database and multi-service tests |
| `tests/api/` | Route and middleware tests |
| `tests/stress/` | Stress and concurrency scripts |
| `tests/scripts/` | Data scripts (e.g. token generation) |
| `tests/helpers/` | Shared test utilities |
| `test-reports/` | Generated MD and HTML reports |
