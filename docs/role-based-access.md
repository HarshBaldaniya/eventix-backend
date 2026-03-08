# Role-Based Access Control (RBAC)

> Documentation of the role-based permission system in Eventix — roles, access matrix, middleware implementation, and future improvements.

---

## Table of Contents

- [Roles](#roles)
- [Access Control Matrix](#access-control-matrix)
- [Middleware Implementation](#middleware-implementation)
- [How It Works](#how-it-works)
- [Test Bypass (Non-Production)](#test-bypass-non-production)
- [Suggestions & Future Improvements](#suggestions--future-improvements)

---

## Roles

Eventix uses a simple two-role system stored as a PostgreSQL ENUM:

| Role | Description | Default |
|------|-------------|---------|
| `user` | Standard user — can browse events, book tickets, manage own bookings | ✅ (default for registration) |
| `admin` | Super user — full access to all resources including event management and audit logs | Via seed data only |

> **Note:** Admin accounts cannot be self-registered. The `role` field in the registration request is always overridden to `user`. Admin accounts are created via database seeding.

---

## Access Control Matrix

| Resource | Action | Public (No Auth) | User (JWT) | Admin (JWT) |
|----------|--------|:-:|:-:|:-:|
| **Health** | Check | ✅ | ✅ | ✅ |
| **Auth** | Register | ✅ | ✅ | ✅ |
| **Auth** | Login | ✅ | ✅ | ✅ |
| **Auth** | Logout | ✅ | ✅ | ✅ |
| **Auth** | Refresh | ✅ | ✅ | ✅ |
| **Events** | List (published/coming_soon) | ✅ | ✅ | ✅ (all statuses) |
| **Events** | Get by ID (published) | ✅ | ✅ | ✅ (any status) |
| **Events** | Create | ❌ | ❌ | ✅ |
| **Events** | Update | ❌ | ❌ | ✅ |
| **Bookings** | Book tickets | ❌ | ✅ | ✅ |
| **Bookings** | List own | ❌ | ✅ | ✅ (all users) |
| **Bookings** | Get by ID | ❌ | ✅ (own only) | ✅ (any) |
| **Bookings** | Cancel | ❌ | ✅ (own only) | ✅ (any) |
| **Audit Log** | List | ❌ | ❌ | ✅ |

---

## Middleware Implementation

Three middlewares work together to enforce access control:

### 1. `authMiddleware` — JWT Verification

**File:** `src/presentation/middlewares/auth.middleware.ts`

- Extracts `Authorization: Bearer <token>` from request headers
- Verifies JWT signature and expiration using `jwt.verify()`
- Validates token type is `access` (not `refresh`)
- Attaches decoded user to request: `req.user = { id, email, role }`
- Throws `401 EVB401001` if token is missing, invalid, or expired

```
Request → authMiddleware → req.user = { id: 1, email: "...", role: "user" }
```

### 2. `optionalAuthMiddleware` — Conditional Auth

**File:** `src/presentation/middlewares/optional-auth.middleware.ts`

- Same as `authMiddleware` but does **not throw** on missing/invalid tokens
- If token is valid → attaches `req.user` (admin sees draft events)
- If token is missing/invalid → `req.user` remains undefined (public access)
- Used on endpoints that show different data based on role (e.g., event listing)

```
GET /events (no token)  → Public view (published/coming_soon only)
GET /events (admin JWT) → Full view (all statuses including draft)
```

### 3. `requireRole` — Role Guard

**File:** `src/presentation/middlewares/require-role.middleware.ts`

- Checks `req.user.role` against an array of allowed roles
- **Admin always passes** — `role === 'admin'` bypasses all role checks
- Throws `403 EVB403001` if the user's role is not in the allowed list

```typescript
// Route definition:
router.post('/', authMiddleware, requireRole(['admin']), controller.createEvent);
//                  ▲                    ▲
//                  │                    └── Only admin can proceed
//                  └── Must be authenticated first
```

---

## How It Works

### Route-Level Middleware Chain

Each route applies middlewares in order:

```typescript
// Public endpoint (anyone can browse events)
router.get('/events', optionalAuthMiddleware, controller.listEvents);

// Auth required (any logged-in user can book)
router.post('/events/:id/bookings', authMiddleware, controller.bookSpot);

// Admin only (create events)
router.post('/events', authMiddleware, requireRole(['admin']), controller.createEvent);
```

### Service-Level Authorization

Some authorization happens at the **service level** (not middleware), because it depends on the data:

```typescript
// BookingService.cancelBooking()
async cancelBooking(bookingId: number, userId: number, role: string) {
  const booking = await this.bookingRepo.findById(bookingId);
  // Admin can cancel any booking; users can only cancel their own
  if (role !== 'admin' && booking.user_id !== userId) {
    throw new AppError('Forbidden', 403, 'EVB403001');
  }
}
```

| Check | Location | Logic |
|-------|----------|-------|
| Is authenticated? | `authMiddleware` | JWT present and valid |
| Is admin? | `requireRole(['admin'])` | Role check in middleware |
| Is owner? | Service layer | `booking.user_id === userId` |

---

## Test Bypass (Non-Production)

For stress testing, a bypass mechanism skips JWT verification:

```typescript
// auth.middleware.ts
if (process.env.NODE_ENV !== 'prod' && req.headers['x-test-user-id']) {
  req.user = { id: parseInt(bypassUserId), role: 'user' };
  return next();
}
```

| Header | Value | Effect |
|--------|-------|--------|
| `x-test-user-id` | `123` | Sets `req.user = { id: 123, role: 'user' }` |

> ⚠️ **Security:** This bypass is **only active** in non-production environments (`NODE_ENV !== 'prod'`). It is used by the bypass-auth stress test to send 50,000 requests without JWT overhead.

---

## Suggestions & Future Improvements

### Short-Term Enhancements

| Improvement | Description |
|-------------|-------------|
| **Permission Table** | Replace ENUM-based roles with a `permissions` table for fine-grained access (e.g., `event:create`, `booking:cancel-any`) |
| **Role Hierarchy** | Add intermediate roles like `moderator` or `event_manager` with specific permissions |
| **API Key Auth** | Allow third-party integrations to authenticate via API keys instead of JWT |

### Medium-Term Enhancements

| Improvement | Description |
|-------------|-------------|
| **OAuth2 / SSO** | Integrate Google, GitHub, or enterprise SSO providers |
| **2FA for Admin** | Require two-factor authentication for admin accounts |
| **Session Management UI** | Allow users to view and revoke active sessions |
| **IP Whitelisting** | Restrict admin API access to specific IP addresses |

### Long-Term Architecture

| Improvement | Description |
|-------------|-------------|
| **ABAC (Attribute-Based)** | Access decisions based on user attributes, resource properties, and environment conditions |
| **Policy Engine** | External policy engine (e.g., OPA, Casbin) for complex authorization rules |
| **Audit Trail for Auth** | Log all authentication and authorization decisions for security compliance |

---

> **Sources:**
> - [`src/presentation/middlewares/auth.middleware.ts`](../src/presentation/middlewares/auth.middleware.ts)
> - [`src/presentation/middlewares/require-role.middleware.ts`](../src/presentation/middlewares/require-role.middleware.ts)
> - [`src/presentation/middlewares/optional-auth.middleware.ts`](../src/presentation/middlewares/optional-auth.middleware.ts)

---

<p align="center">
  <a href="https://www.linkedin.com/in/hb134/">LinkedIn</a> •
  <a href="https://harshbaldaniya.com">Portfolio</a>
</p>
