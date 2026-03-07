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

## Health

`GET /api/v1/health` — Returns `{ status, db }`. Requires PostgreSQL running.
