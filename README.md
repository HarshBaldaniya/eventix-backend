# Eventix Backend

Node.js + Express + TypeScript + PostgreSQL backend with layered architecture.

## Local Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env: set DB_*, JWT_SECRET
   ```

3. **Initialize database**
   ```bash
   npm run db:init
   npm run db:seed
   ```

4. **Start dev server**
   ```bash
   npm run dev
   ```

### Seed Data

| Type | Email | Password |
|------|-------|----------|
| Admin | `admin@eventix.com` | `Admin@123` |
| User | `user@eventix.com` | `User@123` |

Seed includes 15 events (draft, coming_soon, published) with capacity 25–300.

## Structure

```
src/
├── application/     # Services, DTOs, validators (zod)
├── shared/         # Constants, types, errors, logger, security
├── domain/         # Interfaces, entities
├── infrastructure/ # DB, queries, repositories
└── presentation/   # Controllers, middlewares, routes
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build |
| `npm start` | Run production build |
| `npm run db:init` | Create DB and run schema |
| `npm run db:seed` | Seed users and events |
| `npm run db:seed:down` | Remove seed data |
| `npm run test:all` | Run all tests |

## API

- **Health:** `GET /api/v1/health`
- **Auth:** Register, login, logout, refresh
- **Events:** CRUD (admin), list (public)
- **Bookings:** Create, list, cancel
- **Audit Log:** List (admin)

Full API spec: `docs/Eventix-API.openapi.json`

## Security

| Level | Location | Purpose |
|-------|----------|---------|
| DB | `shared/security/db.security.ts` | Parameterized queries, pool |

## Testing

See **[Testing Guide](docs/testing-guide.md)** for unit, integration, API, and stress tests.

```bash
npm run test:all
npm run test:stress-full
```
