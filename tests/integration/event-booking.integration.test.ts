// Integration: Full event + booking flow via API - admin creates event, user books, user cancels. Verifies DB + API.
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
import { expectSuccessWithData, expectPagination } from '../helpers/response-assertions';

const HOOK_TIMEOUT = 15_000;
const TEST_TIMEOUT = 15_000;
const unique = () => `evt-bk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

describe('Event + Booking integration - full flow via API', () => {
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

  it('admin creates event via POST /events, event exists in DB', async () => {
    const agent = getTestAgent();
    const res = await agent
      .post('/api/v1/events')
      .set(authHeader(adminTokens.access_token))
      .send({ name: 'Integration Full Flow Event', description: 'E2E test event', capacity: 20, status: 'published' });

    expectSuccessWithData(res, 201, ['id', 'name', 'capacity', 'status']);
    eventId = res.body.data.id;
    expect(res.body.data.name).toBe('Integration Full Flow Event');
    expect(res.body.data.capacity).toBe(20);

    const row = await pool.query('SELECT id, name, capacity, booked_count FROM events WHERE id = $1', [eventId]);
    expect(row.rows.length).toBe(1);
    expect(row.rows[0].booked_count).toBe(0);
  }, TEST_TIMEOUT);

  it('user books via POST /events/:id/bookings, booking exists in DB', async () => {
    const agent = getTestAgent();
    const res = await agent
      .post(`/api/v1/events/${eventId}/bookings`)
      .set(authHeader(userTokens.access_token))
      .send({ ticket_count: 3 });

    expectSuccessWithData(res, 201, ['id', 'event_id', 'user_id', 'ticket_count', 'status']);
    bookingId = res.body.data.id;
    expect(res.body.data.ticket_count).toBe(3);
    expect(res.body.data.status).toBe('confirmed');

    const row = await pool.query(
      'SELECT id, event_id, ticket_count, status FROM bookings WHERE id = $1',
      [bookingId]
    );
    expect(row.rows.length).toBe(1);
    expect(Number(row.rows[0].ticket_count)).toBe(3);

    const eventRow = await pool.query('SELECT booked_count FROM events WHERE id = $1', [eventId]);
    expect(Number(eventRow.rows[0].booked_count)).toBe(3);
  }, TEST_TIMEOUT);

  it('GET /events/:id returns correct remaining_spots after booking', async () => {
    const agent = getTestAgent();
    const res = await agent.get(`/api/v1/events/${eventId}`);
    expectSuccessWithData(res, 200, ['remaining_spots', 'booked_count']);
    expect(res.body.data.remaining_spots).toBe(17);
    expect(res.body.data.booked_count).toBe(3);
  }, TEST_TIMEOUT);

  it('user cancels booking via PATCH /bookings/:id, status updated in DB', async () => {
    const agent = getTestAgent();
    const res = await agent
      .patch(`/api/v1/bookings/${bookingId}`)
      .set(authHeader(userTokens.access_token))
      .send({ status: 'cancelled' });

    expectSuccessWithData(res, 200, ['id', 'status']);
    expect(res.body.data.status).toBe('cancelled');

    const row = await pool.query('SELECT status FROM bookings WHERE id = $1', [bookingId]);
    expect(row.rows[0].status).toBe('cancelled');

    const eventRow = await pool.query('SELECT booked_count FROM events WHERE id = $1', [eventId]);
    expect(Number(eventRow.rows[0].booked_count)).toBe(0);
  }, TEST_TIMEOUT);

  it('GET /events returns event in list with pagination', async () => {
    const agent = getTestAgent();
    const res = await agent.get('/api/v1/events?page=1&limit=10');
    expect(res.status).toBe(200);
    expectPagination(res);
    const found = res.body.data.find((e: { id: number }) => e.id === eventId);
    expect(found).toBeDefined();
    expect(found.name).toBe('Integration Full Flow Event');
  }, TEST_TIMEOUT);
});
