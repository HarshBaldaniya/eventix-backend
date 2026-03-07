// Integration: Verify audit log entries when events and bookings are created/updated via API.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestAgent } from '../helpers/test-app';
import {
  getPool,
  schemaExists,
  deleteEvent,
  deleteUser,
  deleteBooking,
} from '../helpers/db-setup';
import { createAdminAndLogin, registerUser, authHeader } from '../helpers/auth-helper';
import { expectSuccessWithData } from '../helpers/response-assertions';

const HOOK_TIMEOUT = 15_000;
const TEST_TIMEOUT = 15_000;
const unique = () => `audit-int-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

describe('Audit integration - event_audit_log and booking_audit_log', () => {
  let pool: Awaited<ReturnType<typeof getPool>>;
  let adminTokens: { access_token: string };
  let userTokens: { access_token: string };
  let eventId!: number;
  let bookingId!: number;
  let adminEmail: string;
  let userEmail: string;
  let setupComplete = false;

  beforeAll(async () => {
    getTestAgent();
    pool = await getPool();
    if (!(await schemaExists(pool))) {
      throw new Error('DB schema not initialized. Run: npm run db:init');
    }

    adminEmail = `${unique()}@test.local`;
    userEmail = `${unique()}@test.local`;
    adminTokens = await createAdminAndLogin(adminEmail, 'AdminPass123');
    userTokens = await registerUser(userEmail, 'UserPass123');
    setupComplete = true;
  }, HOOK_TIMEOUT);

  afterAll(async () => {
    if (!setupComplete || !pool) return;
    try {
      if (typeof bookingId === 'number') await deleteBooking(pool, bookingId);
      if (typeof eventId === 'number') await deleteEvent(pool, eventId);
    } catch {
      /* ignore cleanup errors */
    }
    const adminRow = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    const userRow = await pool.query('SELECT id FROM users WHERE email = $1', [userEmail]);
    if (adminRow.rows[0]) await deleteUser(pool, adminRow.rows[0].id);
    if (userRow.rows[0]) await deleteUser(pool, userRow.rows[0].id);
  });

  it('creating event via API inserts event_audit_log entry', async () => {
    const agent = getTestAgent();
    const res = await agent
      .post('/api/v1/events')
      .set(authHeader(adminTokens.access_token))
      .send({ name: 'Audit Test Event', description: 'For audit verification', capacity: 10, status: 'published' });

    expectSuccessWithData(res, 201, ['id']);
    eventId = res.body.data.id;

    const auditRow = await pool.query(
      'SELECT id, operation, event_id, outcome FROM event_audit_log WHERE event_id = $1 ORDER BY created_at DESC LIMIT 1',
      [eventId]
    );
    expect(auditRow.rows.length).toBe(1);
    expect(auditRow.rows[0].operation).toBe('create');
    expect(auditRow.rows[0].outcome).toBe('success');
  }, TEST_TIMEOUT);

  it('booking via API inserts booking_audit_log entry', async () => {
    const agent = getTestAgent();
    const res = await agent
      .post(`/api/v1/events/${eventId}/bookings`)
      .set(authHeader(userTokens.access_token))
      .send({ ticket_count: 1 });

    expectSuccessWithData(res, 201, ['id']);
    bookingId = res.body.data.id;

    const auditRow = await pool.query(
      'SELECT id, operation, booking_id, outcome FROM booking_audit_log WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1',
      [bookingId]
    );
    expect(auditRow.rows.length).toBe(1);
    expect(auditRow.rows[0].operation).toBe('book');
    expect(auditRow.rows[0].outcome).toBe('success');
  }, TEST_TIMEOUT);

  it('admin can fetch audit log via GET /audit-log with event and booking entries', async () => {
    const agent = getTestAgent();
    const res = await agent
      .get('/api/v1/audit-log?page=1&limit=50')
      .set(authHeader(adminTokens.access_token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const eventEntry = res.body.data.find(
      (e: { resource_type?: string; event_id?: number }) =>
        e.resource_type === 'event' && e.event_id === eventId
    );
    const bookingEntry = res.body.data.find(
      (e: { resource_type?: string; booking_id?: number }) =>
        e.resource_type === 'booking' && e.booking_id === bookingId
    );
    expect(eventEntry).toBeDefined();
    expect(bookingEntry).toBeDefined();
  }, TEST_TIMEOUT);
});
