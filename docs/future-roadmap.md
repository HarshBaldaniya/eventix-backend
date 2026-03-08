# Future Roadmap

> Planned improvements and feature ideas for scaling Eventix beyond the current implementation — organized by priority and effort.

---

## Table of Contents

- [Scalability & Performance](#scalability--performance)
- [Feature Enhancements](#feature-enhancements)
- [Security & Authentication](#security--authentication)
- [DevOps & Automation](#devops--automation)
- [Frontend Improvements](#frontend-improvements)
- [Monitoring & Observability](#monitoring--observability)

---

## Scalability & Performance

| Priority | Improvement | Current State | Future State | Effort |
|----------|-------------|---------------|-------------|--------|
| 🔴 High | **Redis Cluster / Sentinel** | Single Redis instance | HA with automatic failover | Medium |
| 🔴 High | **PostgreSQL Read Replicas** | Single DB instance | Read replicas for list/search queries | Medium |
| 🟡 Medium | **Connection Pooling (PgBouncer)** | Direct pool (`DB_POOL_MAX=20`) | PgBouncer for connection multiplexing | Low |
| 🟡 Medium | **Horizontal Scaling** | Single-process Node.js | PM2 cluster / Docker Swarm / Kubernetes | High |
| 🟡 Medium | **CDN for Static Assets** | Served from origin | CloudFront / Cloudflare CDN | Low |
| 🟢 Low | **Database Partitioning** | Single bookings table | Partition by `event_id` or `created_at` | High |
| 🟢 Low | **Redis Lua Scripts** | Separate DECRBY + validation | Single atomic Lua script for check+decrement | Medium |
| 🟢 Low | **Event-Level Connection Pools** | Shared pool for all events | Isolated pools for hot events | Medium |
| 🟢 Low | **GraphQL API** | REST only | Optional GraphQL layer for flexible queries | High |

---

## Feature Enhancements

### Event Management

| Feature | Description | Effort |
|---------|-------------|--------|
| **Event Date & Time** | Add `start_date`, `end_date`, `venue` fields to events | Low |
| **Event Categories & Tags** | Categorize events (music, tech, sports) with filterable tags | Medium |
| **Event Images** | Upload and display event cover images (S3/Cloudinary) | Medium |
| **Recurring Events** | Support weekly/monthly recurring event series | High |
| **Event Drafts → Publish Workflow** | Multi-step publishing with preview | Medium |
| **Seat Map / Assigned Seating** | Visual seat selection with different pricing tiers | High |

### Booking Experience

| Feature | Description | Effort |
|---------|-------------|--------|
| **Payment Integration** | Stripe / Razorpay payment gateway for paid events | High |
| **Waitlist** | When events sell out, allow users to join a waitlist | Medium |
| **QR Code Tickets** | Generate QR codes for booking verification at entry | Medium |
| **Booking Confirmation Emails** | Send email with booking details and QR code | Medium |
| **Event Reminders** | Email/push notifications before event starts | Medium |
| **Booking Transfer** | Allow users to transfer bookings to another user | Low |
| **Group Bookings** | Book for multiple named attendees in one request | Medium |

### User Experience

| Feature | Description | Effort |
|---------|-------------|--------|
| **User Profile Page** | View and edit profile, change password | Low |
| **Booking History** | Full history with filters and export | Low |
| **Favorites / Wishlist** | Save events for later | Low |
| **Event Reviews & Ratings** | Post-event feedback system | Medium |
| **Social Sharing** | Share events on social media | Low |
| **Multi-Language Support** | i18n for international users | High |

### Admin Dashboard

| Feature | Description | Effort |
|---------|-------------|--------|
| **Analytics Dashboard** | Real-time booking metrics, revenue charts, user growth | High |
| **Bulk Operations** | Bulk update event status, export bookings | Medium |
| **User Management** | View/search/ban users, reset passwords | Medium |
| **Notification Center** | Send announcements to event attendees | Medium |
| **Revenue Reports** | Financial reporting for paid events | High |

---

## Security & Authentication

| Priority | Improvement | Description | Effort |
|----------|-------------|-------------|--------|
| 🔴 High | **OAuth2 / SSO** | Google, GitHub, Microsoft login providers | High |
| 🔴 High | **CSRF Protection** | Cross-site request forgery tokens for cookie-based auth | Low |
| 🟡 Medium | **2FA for Admin** | TOTP-based two-factor authentication for admin accounts | Medium |
| 🟡 Medium | **Fine-Grained Permissions** | Replace role ENUM with permission table (`event:create`, `booking:cancel-any`) | High |
| 🟡 Medium | **API Key Auth** | Long-lived keys for third-party integrations | Medium |
| 🟡 Medium | **Account Lockout** | Lock account after N failed login attempts | Low |
| 🟢 Low | **IP Whitelisting** | Restrict admin API access by IP | Low |
| 🟢 Low | **Security Headers** | Content-Security-Policy, X-Frame-Options (beyond Helmet defaults) | Low |
| 🟢 Low | **Audit Log for Auth** | Log login attempts, token refreshes, permission denials | Medium |

---

## DevOps & Automation

| Priority | Improvement | Description | Effort |
|----------|-------------|-------------|--------|
| 🔴 High | **CI/CD Pipeline** | GitHub Actions: lint → test → build → deploy | Medium |
| 🔴 High | **Docker Compose** | One-command local setup (API + PostgreSQL + Redis) | Medium |
| 🟡 Medium | **Database Migrations** | Replace raw SQL with migration tool (e.g., Knex, Prisma Migrate) | High |
| 🟡 Medium | **Automated Backups** | Scheduled PostgreSQL backups with point-in-time recovery | Medium |
| 🟡 Medium | **Environment Parity** | Staging environment matching production exactly | Medium |
| 🟢 Low | **Swagger UI Hosting** | Auto-host OpenAPI spec as interactive docs | Low |
| 🟢 Low | **Dependabot** | Automated dependency updates with security scanning | Low |
| 🟢 Low | **Code Coverage Reports** | Istanbul/c8 coverage integrated into CI | Low |

---

## Frontend Improvements

| Feature | Description | Effort |
|---------|-------------|--------|
| **PWA Support** | Service worker for offline access and push notifications | Medium |
| **SSR Optimization** | Server-side render critical pages for SEO | Medium |
| **Skeleton Loading** | Improved loading states with content placeholders | Low |
| **Infinite Scroll** | Replace pagination with infinite scroll on events list | Low |
| **Real-Time Updates** | WebSocket for live spot count and booking status | High |
| **Accessibility (a11y)** | Full WCAG 2.1 AA compliance | Medium |
| **E2E Testing** | Playwright/Cypress end-to-end test suite | High |

---

## Monitoring & Observability

| Tool | Purpose | Effort |
|------|---------|--------|
| **APM (Datadog / New Relic)** | Application performance monitoring, error tracking | Medium |
| **Structured Logging** | JSON logs with correlation IDs for distributed tracing | Low |
| **Health Dashboard** | Grafana dashboard for Redis, PostgreSQL, API metrics | Medium |
| **Error Tracking (Sentry)** | Real-time error capture with stack traces | Low |
| **Uptime Monitoring** | External monitoring for production health endpoint | Low |
| **Load Testing CI** | Automated stress tests in CI pipeline | Medium |

---

> This roadmap represents potential improvements — not a commitment. Priorities should be driven by user feedback and business needs.

---

<p align="center">
  <a href="https://www.linkedin.com/in/hb134/">LinkedIn</a> •
  <a href="https://harshbaldaniya.com">Portfolio</a>
</p>
