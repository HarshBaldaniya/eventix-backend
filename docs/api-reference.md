# API Reference

> Complete REST API documentation for Eventix — all endpoints, request/response formats, authentication requirements, and error codes.

---

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Error Format](#error-format)
- [Endpoints](#endpoints)
  - [Health](#health)
  - [Auth](#auth)
  - [Events](#events)
  - [Bookings](#bookings)
  - [Audit Log](#audit-log)
- [OpenAPI Specification](#openapi-specification)

---

## Base URL

| Environment | URL |
|-------------|-----|
| Local Development | `http://localhost:3000/api/v1` |
| Production (Render) | `https://<your-service>.onrender.com/api/v1` |

---

## Authentication

Most endpoints require a **JWT Bearer token** in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Tokens are obtained via `/auth/register` or `/auth/login`. Access tokens expire in **1 hour**; use `/auth/refresh` to obtain new tokens.

| Access Level | Description |
|-------------|-------------|
| **Public** | No authentication required |
| **Auth Required** | Valid JWT access token needed |
| **Admin Only** | JWT with `role: admin` required |

---

## Rate Limiting

- **Default:** 100 requests per minute per IP
- **Response when exceeded:** `429 Too Many Requests`
- **Configurable via:** `API_RATE_LIMIT_WINDOW_MS` and `API_RATE_LIMIT_MAX_REQUESTS`
- **Excluded:** `/health` endpoint (for load balancer probes)

---

## Error Format

All errors follow a consistent envelope:

```json
{
  "success": false,
  "error": {
    "code": "EVB409001",
    "message": "This event is sold out",
    "details": { "event_id": 1 }
  }
}
```

| Error Code | HTTP Status | Meaning |
|------------|-------------|---------|
| `EVB400001` | 400 | Validation failed |
| `EVB401001` | 401 | Authentication required / invalid token |
| `EVB403001` | 403 | Forbidden (insufficient permissions) |
| `EVB404001` | 404 | Resource not found |
| `EVB409001` | 409 | Event sold out / not enough spots |
| `EVB409003` | 409 | Email already registered |
| `EVB409004` | 409 | Per-booking ticket limit exceeded |
| `EVB409005` | 409 | Per-user ticket limit exceeded |
| `EVB409006` | 409 | Event not open for booking |
| `EVB422001` | 422 | Booking already cancelled |
| `EVB429001` | 429 | Rate limit exceeded |
| `EVB503001` | 503 | Database unavailable |

---

## Endpoints

### Health

#### `GET /api/v1/health`

Health check for API and database connectivity. No authentication required.

| | |
|---|---|
| **Auth** | Public |
| **Response** | `200 OK` / `503 Service Unavailable` |

**Success Response:**
```json
{
  "status": "ok",
  "db": "connected"
}
```

---

### Auth

#### `POST /api/v1/auth/register`

Register a new user account. Returns access and refresh tokens.

| | |
|---|---|
| **Auth** | Public |
| **Response** | `201 Created` / `400` / `409` / `429` |

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123",
  "name": "John Doe"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "user": { "id": 1, "email": "user@example.com", "name": "John Doe" },
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 3600
  }
}
```

---

#### `POST /api/v1/auth/login`

Authenticate with email and password.

| | |
|---|---|
| **Auth** | Public |
| **Response** | `200 OK` / `401` / `429` |

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123"
}
```

**Success Response (200):** Same structure as register.

---

#### `POST /api/v1/auth/logout`

Invalidate the current session.

| | |
|---|---|
| **Auth** | Public (uses refresh token) |
| **Response** | `200 OK` / `400` |

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

#### `POST /api/v1/auth/refresh`

Exchange a valid refresh token for new access and refresh tokens.

| | |
|---|---|
| **Auth** | Public (uses refresh token) |
| **Response** | `200 OK` / `401` |

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Success Response (200):** Same structure as register/login.

---

### Events

#### `GET /api/v1/events`

List events with pagination, search, and sorting.

| | |
|---|---|
| **Auth** | Public (published/coming_soon only) · Admin sees all statuses |
| **Response** | `200 OK` |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-based) |
| `limit` | integer | 10 | Items per page (max 100) |
| `search` | string | — | Search in name and description (max 200 chars) |
| `status` | string | — | Filter by status (admin only) |
| `sort_by` | string | `created_at` | Sort field: `created_at`, `name`, `remaining_spots` |
| `order` | string | `desc` | Sort order: `asc`, `desc` |

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Summer Concert 2025",
      "description": "Annual summer concert",
      "capacity": 100,
      "booked_count": 25,
      "remaining_spots": 75,
      "status": "published",
      "created_at": "2025-03-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "total_pages": 1,
    "has_next": false,
    "has_prev": false
  }
}
```

---

#### `POST /api/v1/events`

Create a new event.

| | |
|---|---|
| **Auth** | Admin only |
| **Response** | `201 Created` / `400` / `401` / `403` |

**Request Body:**
```json
{
  "name": "Summer Concert 2025",
  "description": "Annual summer concert at the park",
  "capacity": 100,
  "status": "draft"
}
```

---

#### `GET /api/v1/events/:eventId`

Get a single event by ID.

| | |
|---|---|
| **Auth** | Public (published/coming_soon) · Admin sees all |
| **Response** | `200 OK` / `400` / `404` |

---

#### `PATCH /api/v1/events/:eventId`

Update an event (partial update).

| | |
|---|---|
| **Auth** | Admin only |
| **Response** | `200 OK` / `400` / `401` / `403` / `404` |

**Request Body** (all fields optional):
```json
{
  "name": "Updated Event Name",
  "description": "Updated description",
  "capacity": 120,
  "status": "published"
}
```

> **Note:** New capacity must be ≥ current `booked_count`.

---

### Bookings

#### `POST /api/v1/events/:eventId/bookings`

Book tickets for a published event.

| | |
|---|---|
| **Auth** | Auth required |
| **Response** | `201 Created` / `400` / `401` / `404` / `409` / `429` |

**Request Body:**
```json
{
  "ticket_count": 2
}
```

**Limits:**
- `max_tickets_per_booking`: 6 (default)
- `max_tickets_per_user`: 15 (default, total across all bookings for this event)

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "event_id": 1,
    "user_id": 1,
    "ticket_count": 2,
    "status": "confirmed",
    "created_at": "2025-03-06T10:00:00.000Z",
    "updated_at": "2025-03-06T10:00:00.000Z"
  }
}
```

---

#### `GET /api/v1/bookings`

List bookings with pagination.

| | |
|---|---|
| **Auth** | Auth required (own bookings) · Admin sees all |
| **Response** | `200 OK` / `401` |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 10 | Items per page (max 100) |

---

#### `GET /api/v1/bookings/:bookingId`

Get a single booking by ID.

| | |
|---|---|
| **Auth** | Auth required (own only) · Admin sees all |
| **Response** | `200 OK` / `401` / `403` / `404` |

---

#### `PATCH /api/v1/bookings/:bookingId`

Cancel a confirmed booking.

| | |
|---|---|
| **Auth** | Auth required (own only) · Admin can cancel any |
| **Response** | `200 OK` / `400` / `401` / `403` / `404` / `422` |

**Request Body** (optional):
```json
{
  "status": "cancelled"
}
```

---

### Audit Log

#### `GET /api/v1/audit-log`

List audit log entries.

| | |
|---|---|
| **Auth** | Admin only |
| **Response** | `200 OK` / `401` / `403` |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 10 | Items per page (max 100) |

---

## Endpoint Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/health` | Public | Health check |
| `POST` | `/api/v1/auth/register` | Public | Register user |
| `POST` | `/api/v1/auth/login` | Public | Login |
| `POST` | `/api/v1/auth/logout` | Public | Logout (invalidate session) |
| `POST` | `/api/v1/auth/refresh` | Public | Refresh tokens |
| `GET` | `/api/v1/events` | Public / Admin | List events |
| `POST` | `/api/v1/events` | Admin | Create event |
| `GET` | `/api/v1/events/:id` | Public / Admin | Get event |
| `PATCH` | `/api/v1/events/:id` | Admin | Update event |
| `POST` | `/api/v1/events/:id/bookings` | Auth | Book tickets |
| `GET` | `/api/v1/bookings` | Auth / Admin | List bookings |
| `GET` | `/api/v1/bookings/:id` | Auth / Admin | Get booking |
| `PATCH` | `/api/v1/bookings/:id` | Auth / Admin | Cancel booking |
| `GET` | `/api/v1/audit-log` | Admin | List audit log |

---

## OpenAPI Specification

The full OpenAPI 3.0.3 specification is available at:

📄 **[`docs/Eventix-API.openapi.json`](./Eventix-API.openapi.json)**

You can import this file into API tools like:
- [Apidog](https://apidog.com)
- [Swagger UI](https://swagger.io/tools/swagger-ui/)
- [Postman](https://www.postman.com/)
- [Insomnia](https://insomnia.rest/)

---

<p align="center">
  <a href="https://www.linkedin.com/in/hb134/">LinkedIn</a> •
  <a href="https://harshbaldaniya.com">Portfolio</a>
</p>
