# Architecture

> Layered backend architecture following **Clean Architecture** principles — each layer has a single responsibility and depends only on the layer below it.

---

## Table of Contents

- [High-Level Overview](#high-level-overview)
- [Layer Responsibilities](#layer-responsibilities)
- [Request Lifecycle](#request-lifecycle)
- [Middleware Pipeline](#middleware-pipeline)
- [Dependency Flow](#dependency-flow)
- [Folder Structure](#folder-structure)

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT (HTTP)                     │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│              PRESENTATION LAYER                     │
│  Middlewares → Routes → Controllers                 │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│              APPLICATION LAYER                      │
│  Services → DTOs → Validators (Zod)                 │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│                DOMAIN LAYER                         │
│  Entities → Interfaces (Repository Contracts)       │
└──────────────────────┬──────────────────────────────┘
                       ▲
┌──────────────────────┴──────────────────────────────┐
│             INFRASTRUCTURE LAYER                    │
│  PostgreSQL │ Redis │ Repositories │ Config         │
└─────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities

### 1. Presentation Layer (`src/presentation/`)

The entry point for all HTTP traffic. This layer is **framework-specific** (Express) and handles:

| Component | File(s) | Purpose |
|-----------|---------|---------|
| **Routes** | `routes/*.routes.ts` | Map HTTP verbs + paths to controllers |
| **Controllers** | `controllers/*.controller.ts` | Parse request → call service → send response |
| **Middlewares** | `middlewares/*.middleware.ts` | Cross-cutting concerns: auth, rate limit, roles, errors |

> Controllers never contain business logic — they delegate entirely to services.

### 2. Application Layer (`src/application/`)

The **business logic** layer. Framework-agnostic — no Express types, no SQL, no Redis.

| Component | File(s) | Purpose |
|-----------|---------|---------|
| **Services** | `services/*.service.ts` | Core business rules, orchestration |
| **DTOs** | `dtos/*.dto.ts` | Data transfer objects (typed response shapes) |
| **Validators** | `validators/*.validator.ts` | Zod schemas for input validation |

> Services depend on **interfaces** from the domain layer, not concrete implementations.

### 3. Domain Layer (`src/domain/`)

The **purest** layer — contains no dependencies, no imports from other layers.

| Component | File(s) | Purpose |
|-----------|---------|---------|
| **Entities** | `entities/*.entity.ts` | Core data models (User, Event, Booking) |
| **Interfaces** | `interfaces/*.interface.ts` | Repository contracts (what, not how) |

> Domain interfaces define **what** the application needs (e.g., `findById`), while infrastructure implements **how**.

### 4. Infrastructure Layer (`src/infrastructure/`)

The **implementation** layer — concrete database access, external services, configuration.

| Component | File(s) | Purpose |
|-----------|---------|---------|
| **Database** | `database/pool.ts` | PostgreSQL connection pool |
| **Database** | `database/redis.client.ts` | Redis client (spot caching) |
| **Database** | `database/transaction.manager.ts` | PostgreSQL transaction wrapper |
| **Database DDL** | `database/ddl/*.sql` | Schema, seed, teardown SQL |
| **Queries** | `database/queries/*.queries.ts` | Raw SQL query strings |
| **Repositories** | `repositories/*.repository.ts` | Implements domain interfaces |
| **Config** | `config/config.loader.ts` | Environment variable loading |

---

## Request Lifecycle

A typical authenticated request flows through:

```
HTTP Request
  │
  ├─► requestIdMiddleware      → Assigns unique X-Request-Id
  ├─► rateLimitMiddleware      → 100 req/min per IP (configurable)
  ├─► CORS                     → Validates origin
  ├─► express.json()           → Parses JSON body
  ├─► authMiddleware           → Verifies JWT, extracts user {id, email, role}
  ├─► requireRole(['admin'])   → Checks role (optional, route-specific)
  │
  ├─► Controller
  │     ├── Validates input (Zod)
  │     └── Calls Service
  │           ├── Business logic
  │           ├── Calls Repository (via interface)
  │           │     └── Executes SQL / Redis ops
  │           └── Returns DTO
  │
  ├─► Response (JSON)
  │
  └─► errorHandler             → Catches AppError → structured JSON error
```

---

## Middleware Pipeline

Middlewares execute in the order they are registered:

| Order | Middleware | File | Purpose |
|-------|-----------|------|---------|
| 1 | CORS | `app.ts` | Cross-origin request handling |
| 2 | JSON Parser | `app.ts` | `express.json()` body parsing |
| 3 | Request ID | `request-id.middleware.ts` | Unique ID per request |
| 4 | Rate Limiter | `rate-limit.middleware.ts` | 100 req/min per IP (skips `/health`) |
| 5 | Auth | `auth.middleware.ts` | JWT verification → `req.user` |
| 6 | Optional Auth | `optional-auth.middleware.ts` | JWT if present (public endpoints) |
| 7 | Role Guard | `require-role.middleware.ts` | Admin-only route protection |
| 8 | Async Handler | `async-handler.middleware.ts` | Catches async errors |
| 9 | Error Handler | `error-handler.middleware.ts` | `AppError` → JSON response |

---

## Dependency Flow

```
Presentation → Application → Domain ← Infrastructure
     │              │            ▲           │
     │              │            │           │
     │              │     Interfaces     Implements
     │              │     (contracts)    (concrete)
     │              │            │           │
     └──── uses ────┘            └───────────┘
```

**Key principle**: Application and Presentation layers depend on Domain **interfaces**. Infrastructure **implements** those interfaces. This allows swapping databases without touching business logic.

---

## Folder Structure

```
src/
├── app.ts                              # Express app setup
├── index.ts                            # Server entry point
│
├── domain/                             # Pure domain (no dependencies)
│   ├── entities/
│   │   ├── user.entity.ts
│   │   ├── event.entity.ts
│   │   └── booking.entity.ts
│   └── interfaces/
│       ├── user.repository.interface.ts
│       ├── event.repository.interface.ts
│       ├── booking.repository.interface.ts
│       ├── booking-audit.repository.interface.ts
│       ├── event-audit.repository.interface.ts
│       ├── event-booking-config.repository.interface.ts
│       ├── session.repository.interface.ts
│       ├── audit-log.repository.interface.ts
│       ├── health.repository.interface.ts
│       └── transaction.interface.ts
│
├── application/                        # Business logic
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── event.service.ts
│   │   ├── booking.service.ts
│   │   ├── health.service.ts
│   │   └── audit-log.service.ts
│   ├── dtos/
│   │   ├── auth.dto.ts
│   │   ├── event.dto.ts
│   │   └── booking.dto.ts
│   └── validators/
│       ├── auth.validator.ts
│       ├── event.validator.ts
│       ├── booking.validator.ts
│       └── ...
│
├── infrastructure/                     # External implementations
│   ├── config/
│   │   └── config.loader.ts
│   ├── database/
│   │   ├── pool.ts                     # PG connection pool
│   │   ├── redis.client.ts             # Redis client
│   │   ├── transaction.manager.ts
│   │   ├── ddl/
│   │   │   ├── schema.sql
│   │   │   ├── seed.sql
│   │   │   └── seed-down.sql
│   │   └── queries/
│   │       ├── user.queries.ts
│   │       ├── event.queries.ts
│   │       ├── booking.queries.ts
│   │       └── ...
│   └── repositories/
│       ├── user.repository.ts
│       ├── event.repository.ts
│       ├── booking.repository.ts
│       └── ...
│
├── presentation/                       # HTTP layer
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── event.controller.ts
│   │   ├── booking.controller.ts
│   │   ├── health.controller.ts
│   │   └── audit-log.controller.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts
│   │   ├── optional-auth.middleware.ts
│   │   ├── require-role.middleware.ts
│   │   ├── rate-limit.middleware.ts
│   │   ├── request-id.middleware.ts
│   │   ├── async-handler.middleware.ts
│   │   └── error-handler.middleware.ts
│   └── routes/
│       ├── routes.ts                   # Root router
│       ├── health.routes.ts
│       ├── auth.routes.ts
│       ├── event.routes.ts
│       ├── booking.routes.ts
│       └── audit-log.routes.ts
│
└── shared/                             # Cross-cutting utilities
    ├── constants/
    │   ├── api.constants.ts
    │   ├── status-code.constants.ts
    │   ├── error-code.constants.ts
    │   └── ...
    ├── errors/
    │   └── app.error.ts                # Custom error class
    ├── logger/
    │   └── logger.ts                   # Winston logger
    ├── security/
    │   └── db.security.ts              # Parameterized query helpers
    ├── types/
    │   └── express.d.ts                # Express type extensions
    └── utils/
        └── ...
```

---

<p align="center">
  <a href="https://www.linkedin.com/in/hb134/">LinkedIn</a> •
  <a href="https://harshbaldaniya.com">Portfolio</a>
</p>
