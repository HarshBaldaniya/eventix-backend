// API tests: Events - GET/POST/PATCH /events, POST /events/:id/bookings
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestAgent } from '../helpers/test-app';
import {
  getPool,
  schemaExists,
  createTestEvent,
  createTestBooking,
  deleteEvent,
  deleteUser,
  deleteBooking,
} from '../helpers/db-setup';
import { registerUser, createAdminAndLogin, authHeader } from '../helpers/auth-helper';
import { expectSuccess, expectSuccessWithData, expectError, expectPagination } from '../helpers/response-assertions';
import { EVB400001, EVB401001, EVB403001, EVB404001, EVB409001 } from '../../src/shared/constants/error-code.constants';

const TEST_TIMEOUT = 15_000;
const HOOK_TIMEOUT = 15_000;

describe('Events API', () => {
  let agent: ReturnType<typeof getTestAgent>;
  let adminTokens: { access_token: string };
  let userTokens: { access_token: string };
  let eventId: number;
  let eventIdForBooking: number;
  let userId: number;
  let adminEmail: string;
  let userEmail: string;
  let pool: Awaited<ReturnType<typeof getPool>>;
  let setupComplete = false;

  beforeAll(async () => {
    agent = getTestAgent();
    const poolRes = await getPool();
    pool = poolRes;
    if (!(await schemaExists(pool))) {
      throw new Error('DB schema not initialized. Run: npm run db:init');
    }

    const ts = Date.now();
    adminEmail = `events-admin-${ts}@test.local`;
    userEmail = `events-user-${ts}@test.local`;

    adminTokens = await createAdminAndLogin(adminEmail, 'AdminPass123');
    const userData = await registerUser(userEmail, 'UserPass123');
    userTokens = userData;

    const uidResult = await pool.query('SELECT id FROM users WHERE email = $1', [userEmail]);
    userId = uidResult.rows[0].id;

    eventId = await createTestEvent(pool, 'API Test Event', 'Description', 10, 'published');
    eventIdForBooking = await createTestEvent(pool, 'Booking Test Event', 'For booking', 2, 'published');
    setupComplete = true;
  }, HOOK_TIMEOUT);

  afterAll(async () => {
    if (!setupComplete || !pool) return;
    await deleteEvent(pool, eventId);
    await deleteEvent(pool, eventIdForBooking);
    const adminRow = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    const userRow = await pool.query('SELECT id FROM users WHERE email = $1', [userEmail]);
    if (adminRow.rows[0]) await deleteUser(pool, adminRow.rows[0].id);
    if (userRow.rows[0]) await deleteUser(pool, userRow.rows[0].id);
  });

  it('GET /api/v1/events returns 200 with data and pagination (public)', async () => {
    const res = await agent.get('/api/v1/events');
    expectSuccess(res, 200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expectPagination(res);
  }, TEST_TIMEOUT);

  it('GET /api/v1/events?page=1&limit=5 returns 200 with valid pagination', async () => {
    const res = await agent.get('/api/v1/events?page=1&limit=5');
    expectSuccess(res, 200);
    expectPagination(res);
    expect(res.body.pagination.limit).toBe(5);
    expect(res.body.pagination.page).toBe(1);
  }, TEST_TIMEOUT);

  it('GET /api/v1/events/:id returns 200 with event data', async () => {
    const res = await agent.get(`/api/v1/events/${eventId}`);
    expectSuccessWithData(res, 200, ['id', 'name', 'description', 'capacity', 'status']);
    expect(res.body.data.id).toBe(eventId);
    expect(res.body.data.name).toBe('API Test Event');
  }, TEST_TIMEOUT);

  it('GET /api/v1/events/999999 returns 404', async () => {
    const res = await agent.get('/api/v1/events/999999');
    expectError(res, 404, EVB404001);
  }, TEST_TIMEOUT);

  it('POST /api/v1/events without auth returns 401', async () => {
    const res = await agent
      .post('/api/v1/events')
      .send({ name: 'New Event', description: 'Desc', capacity: 10 });
    expectError(res, 401, EVB401001);
  }, TEST_TIMEOUT);

  it('POST /api/v1/events with user token returns 403', async () => {
    const res = await agent
      .post('/api/v1/events')
      .set(authHeader(userTokens.access_token))
      .send({ name: 'New Event', description: 'Desc', capacity: 10 });
    expectError(res, 403, EVB403001);
  }, TEST_TIMEOUT);

  it('POST /api/v1/events with admin returns 201', async () => {
    const res = await agent
      .post('/api/v1/events')
      .set(authHeader(adminTokens.access_token))
      .send({ name: 'Admin Created Event', description: 'Created by admin', capacity: 50 });
    expectSuccessWithData(res, 201, ['id', 'name', 'capacity', 'status']);
    expect(res.body.data.name).toBe('Admin Created Event');
    expect(res.body.data.capacity).toBe(50);
    const createdId = res.body.data.id;
    await deleteEvent(pool, createdId);
  }, TEST_TIMEOUT);

  it('POST /api/v1/events with invalid body returns 400', async () => {
    const res = await agent
      .post('/api/v1/events')
      .set(authHeader(adminTokens.access_token))
      .send({ name: '', capacity: 0 });
    expectError(res, 400, EVB400001);
  }, TEST_TIMEOUT);

  it('PATCH /api/v1/events/:id with admin returns 200', async () => {
    const res = await agent
      .patch(`/api/v1/events/${eventId}`)
      .set(authHeader(adminTokens.access_token))
      .send({ name: 'Updated Event Name', capacity: 15 });
    expectSuccessWithData(res, 200, ['id', 'name', 'capacity']);
    expect(res.body.data.name).toBe('Updated Event Name');
    expect(res.body.data.capacity).toBe(15);
    await agent
      .patch(`/api/v1/events/${eventId}`)
      .set(authHeader(adminTokens.access_token))
      .send({ name: 'API Test Event', capacity: 10 });
  }, TEST_TIMEOUT);

  it('PATCH /api/v1/events/999999 returns 404', async () => {
    const res = await agent
      .patch('/api/v1/events/999999')
      .set(authHeader(adminTokens.access_token))
      .send({ name: 'Updated' });
    expectError(res, 404, EVB404001);
  }, TEST_TIMEOUT);

  it('POST /api/v1/events/:id/bookings without auth returns 401', async () => {
    const res = await agent
      .post(`/api/v1/events/${eventIdForBooking}/bookings`)
      .send({ ticket_count: 1 });
    expectError(res, 401, EVB401001);
  }, TEST_TIMEOUT);

  it('POST /api/v1/events/:id/bookings with auth returns 201', async () => {
    const res = await agent
      .post(`/api/v1/events/${eventIdForBooking}/bookings`)
      .set(authHeader(userTokens.access_token))
      .send({ ticket_count: 1 });
    expectSuccessWithData(res, 201, ['id', 'event_id', 'user_id', 'ticket_count', 'status']);
    expect(res.body.data.status).toBe('confirmed');
    const bookingId = res.body.data.id;
    await deleteBooking(pool, bookingId);
    await pool.query('UPDATE events SET booked_count = booked_count - 1 WHERE id = $1', [eventIdForBooking]);
  }, TEST_TIMEOUT);

  it('POST /api/v1/events/:id/bookings with invalid ticket_count returns 400', async () => {
    const res = await agent
      .post(`/api/v1/events/${eventIdForBooking}/bookings`)
      .set(authHeader(userTokens.access_token))
      .send({ ticket_count: -1 });
    expectError(res, 400, EVB400001);
  }, TEST_TIMEOUT);

  it('POST /api/v1/events/999999/bookings returns 404', async () => {
    const res = await agent
      .post('/api/v1/events/999999/bookings')
      .set(authHeader(userTokens.access_token))
      .send({ ticket_count: 1 });
    expectError(res, 404, EVB404001);
  }, TEST_TIMEOUT);

  it('POST /api/v1/events/:id/bookings when overbooked returns 409', async () => {
    const smallEventId = await createTestEvent(pool, 'Small Event', 'Cap 1', 1, 'published');
    await createTestBooking(pool, smallEventId, userId, 1);
    await pool.query('UPDATE events SET booked_count = 1 WHERE id = $1', [smallEventId]);
    const res = await agent
      .post(`/api/v1/events/${smallEventId}/bookings`)
      .set(authHeader(userTokens.access_token))
      .send({ ticket_count: 1 });
    expectError(res, 409, EVB409001);
    await deleteEvent(pool, smallEventId);
  }, TEST_TIMEOUT);
});
