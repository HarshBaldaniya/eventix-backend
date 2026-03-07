# Eventix Testing Guide 🧪

This guide explains **what** we test in the Eventix project, **why** we test it, and **how** each script ensures our system can handle everything from simple logic to massive flash sales.

---

## 1. Standard Logic Tests (Vitest)

These are used for daily development to ensure the core rules of the project are never broken.

### 🧩 Unit Tests
- **What is it?**: Testing a single piece of code (like a function) in isolation.
- **Project Example**: Testing that the `BookingService` correctly rejects a request if the `ticket_count` (e.g., 20) is higher than the allowed `max_tickets_per_booking` (e.g., 6).
- **Why?**: If we change the code for "Premium Tickets", we want to be 100% sure we didn't break the basic "Max Tickets" rule.
- **Run**: `npm run test:unit`

### 🔗 Integration Tests
- **What is it?**: Testing how the code talks to the real Database.
- **Project Example**: Verifying that calling `bookSpot()` actually creates a row in the `bookings` table and updates the `booked_count` in the `events` table correctly.
- **Why?**: To ensure our SQL queries are correct and that data is saved safely.
- **Run**: `npm run test:integration`

### 🌐 API Tests
- **What is it?**: Testing the full HTTP "End-to-End" flow.
- **Project Example**: Sending a real POST request to `/api/v1/auth/login` and checking if we get back a valid JWT access token.
- **Run**: `npm run test:api` (or `npm run test:all` for everything)

---

## 2. High-Traffic Stress Tests (`tests/stress/`)

These are specialized tests designed to simulate "Flash Sale" scenarios where thousands of users compete for just a few spots. They are designed to prove our Redis architecture and Database transaction locks work perfectly under extreme pressure.

### 1. Full-Auth Stress Test (`test-booking-full-auth.ts`)
- **What is it?**: Simulates 50 real users who simultaneously **register**, **login**, and then **book a ticket**.
- **The Flow**:
    1. Creates 50 unique test users on the fly.
    2. Sends 50 simultaneous `/auth/register` and `/auth/login` requests.
    3. Sends 50 simultaneous POST `/events/:id/bookings` requests using the newly received JWTs.
- **Why?**: This proves that our authentication flow generates valid JWTs under pressure, and the database can handle writes to the `users`, `sessions`, and `bookings` tables simultaneously without deadlocks on initial creation.
- **Run**: `npm run test:stress-full`

### 2. Extreme Bypass Test (`test-booking-bypass-auth.ts`)
- **What is it?**: Simulates **5,000+ users** hitting the booking API at the exact same millisecond. To achieve this speed, it generates a "fake" JWT signature that the server trusts (bypassing the slow bcrypt/database login).
- **The Flow**:
    1. Reads user IDs from pre-seeded data (`npm run db:seed-stress`).
    2. Constructs 5,000 minimal JWTs in memory.
    3. Fires 5000 requests instantly at the server for an event with only 5 remaining spots.
- **Why?**: This proves our **Redis Gatekeeper** is lightning fast. It proves that exactly 5 users succeed, and 4,995 users get an instant `409 Sold Out` message without touching the PostgreSQL database, meaning the server doesn't crash from overwhelming DB connections.
- **⚠️ CRITICAL STEP**: Run the seeding script first: `npm run db:seed-stress`. Without this, there are no users to inject into the JWTs.
- **Run**: `npm run test:stress-bypass`

### 3. Mega-Auth Stress Test (`test-booking-mega-auth.ts`)
- **What is it?**: The ultimate test. Simulating **50,000** completely real, fully authenticated users hitting the booking endpoint simultaneously.
- **The Flow (How to Run)**:
    This test requires a massive amount of data to be pre-generated so we don't crash our system just setting up the test!
    1. **Create the Users**: Run `npm run db:seed-stress`. This connects directly to PostgreSQL and inserts 50,000 rows into the `users` table.
    2. **Generate the Keys**: Run `npm run test:tokens`. This uses our `generate-stress-tokens.ts` script to act as the Auth Service. It creates 50,000 mathematically valid JWT Access Tokens and saves them to a local JSON cache file.
    3. **Launch the Attack**: Run `npm run test:mega-auth`. This script reads the cached tokens into memory and fires 50,000 `POST /events/:id/bookings` requests at the server as fast as Node can push them.
- **Why?**: To test how the system performs when it has to verify a real cryptographic signature (`jwt.verify`) and handle Express request parsing for every single request at 50k scale. It proves our `app` is production-ready for massive, real-world API traffic spikes.

---

## 3. Security: Rate-Limit Protection (`test:rate-limit`)

### 🛡️ Why do we test this?
To prevent bots and hackers from "stressing" our server by sending thousands of requests per second. We want to ensure that only "good" traffic gets through and "bad" traffic is blocked.

### 🧠 The Simple Logic:
1.  **The Rule**: We allow exactly **100 requests** per minute per user.
2.  **The Test**: We send **105 requests** very fast.
3.  **The Goal**:
    -   Requests **1 to 100** should be **✅ SUCCESS (200 OK)**.
    -   Requests **101 to 105** should be **❌ BLOCKED (429 Too Many Requests)**.
4.  **Result**: If the server blocks exactly after 100, the security is working!

---

## 4. 📊 Unified Reporting System

We have a premium reporting infrastructure that combines all test types into easy-to-read dashboards.

### 📝 Markdown Report (`test-reports/TEST-REPORT.md`)
- **What**: A clean, technical summary of all Vitest results.
- **Why**: Perfect for a quick check in VS Code or during a Code Review.

### 🎨 HTML Dashboard (`test-reports/report.html`)
- **What**: A high-fidelity, visual dashboard including Stress & Security metrics.
- **Why**: Best for a high-level view of system health, showing concurrency stats and rate-limiting successes visually.

---

## 🛠️ Step-by-Step Stress Testing & Reporting Workflow

To properly run a full cycle and see the visual results, follow this exact execution order:

1. **Test Rate Limiting Security** (Ensure the gatekeeper works before we scale)
   ```bash
   npm run test:rate-limit
   ```
2. **Run All Standard Logic Tests** (Verify no basic rules are broken)
   ```bash
   npm run test:all
   ```
3. **Run 50-User Full Flow** (Simulate standard traffic)
   ```bash
   npm run test:stress-full
   ```
4. **Extreme Bypass Test (5,000 Users)**
   ```bash
   npm run db:seed-stress
   npm run test:stress-bypass
   ```
5. **Mega-Auth Test (50,000 Users)**
   ```bash
   npm run test:tokens
   npm run test:mega-auth
   ```
6. **Generate & View the Final Report**
   ```bash
   npm run test:report
   ```
   *Then open `test-reports/report.html` in your browser!*

---

## ❌ Common Errors & Solutions

| Error | Cause | Solution |
| :--- | :--- | :--- |
| `Only found 0 stress users` | You skipped the seeding step. | Run `npm run db:seed-stress` |
| `Event not found (404)` | DB not initialized or event ID sync issue. | Run `npm run db:init` and retry. |
| `Redis connection error` | Local Redis server is not running. | Start Redis (`redis-server`) on localhost:6379. |
| `Rate limit not triggered` | `x-test-rate-limit` header missing. | Ensure you are using the provided test scripts. |

---

## 5. Test Infrastructure Folders

| Folder | What's inside? |
| :--- | :--- |
| `tests/unit/` | Isolated logic tests. |
| `tests/integration/` | Database and multi-service tests. |
| `tests/api/` | Route and middleware tests. |
| `tests/stress/` | High-concurrency performance scripts. |
| `tests/scripts/` | Specialized data scripts (like seeding users). |
| `test-reports/` | **[NEW]** Generated MD and HTML reports. |

---

## 6. Command Cheat Sheet

| Command | Category | Purpose |
| :--- | :--- | :--- |
| `npm run test:all` | **Core** | Run all basic logic, integration, and API tests. |
| `npm run test:stress-full` | **Stress** | Test behavior with 50 simultaneous real user flows (Reg -> Login -> Book). |
| `npm run test:stress-bypass` | **Stress** | Test Redis speed with 5,000 simultaneous bursts (bypasses auth). |
| `npm run test:mega-auth` | **Stress** | **The Ultimate Test**: 50,000 fully authenticated simultaneous booking requests. |
| `npm run test:rate-limit` | **Security** | Check if the API successfully blocks sequential spamming over 100 req/min. |
| `npm run test:report` | **Reporting** | Generate the Unified HTML & MD Test Dashboard. |
| `npm run test:tokens` | **Setup** | Pre-generate 50,000 valid JWT access tokens into a local JSON cache file. |
| `npm run db:seed-stress` | **Setup** | Insert 50,000 test users directly into PostgreSQL for stress testing. |

