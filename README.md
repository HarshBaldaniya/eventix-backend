# Backend — Layered Architecture

Node.js + Express + TypeScript + PostgreSQL backend with layered architecture.

## Structure

```
src/
├── application/     # Services, DTOs, validators (zod)
├── shared/         # Constants, types, errors, logger, security
├── domain/         # Interfaces, entities
├── infrastructure/ # DB, queries, repositories
└── presentation/   # Controllers, middlewares, routes
```

## Security

| Level | Location | Purpose |
|-------|----------|---------|
| DB    | `shared/security/db.security.ts` | Parameterized queries, pool |

## Commands

```bash
# Install
npm install

# Dev (with hot reload)
npm run dev

# Build
npm run build

# Start (production)
npm start
```

## Env

Copy `.env.example` to `.env` and set `DB_*` for PostgreSQL.

## Testing

For detailed instructions on running automated tests, concurrency stress tests, and rate-limit validation, see the **[Testing Guide](docs/testing-guide.md)**.

```bash
# Run all vitest tests
npm run test:all

# Run high-traffic stress test (50 users)
npm run test:stress-full
```

## Health

`GET /api/v1/health` — Returns `{ status, db }`. Requires PostgreSQL running.
