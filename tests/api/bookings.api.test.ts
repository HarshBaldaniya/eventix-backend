// API tests: Bookings - GET /bookings (list), GET /bookings/:id, PATCH /bookings/:id (cancel)
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
import { registerUser, authHeader } from '../helpers/auth-helper';
import { expectSuccess, expectSuccessWithData, expectError, expectPagination } from '../helpers/response-assertions';
import { EVB401001, EVB404001 } from '../../src/shared/constants/error-code.constants';

const TEST_TIMEOUT = 15_000;
const HOOK_TIMEOUT = 15_000;

describe('Bookings API', () => {
  let agent: ReturnType<typeof getTestAgent>;
  let userTokens: { access_token: string };
  let eventId: number;
  let bookingId: number;
  let userEmail: string;
  let pool: Awaited<ReturnType<typeof getPool>>;
  let setupComplete = false;

  beforeAll(async () => {
    agent = getTestAgent();
    pool = await getPool();
    if (!(await schemaExists(pool))) {
      throw new Error('DB schema not initialized. Run: npm run db:init');
    }

    const ts = Date.now();
    userEmail = `bookings-user-${ts}@test.local`;
    const userData = await registerUser(userEmail, 'UserPass123');
    userTokens = userData;

    eventId = await createTestEvent(pool, 'Bookings Test Event', 'For list/get/cancel', 5, 'published');
    const userIdResult = await pool.query('SELECT id FROM users WHERE email = $1', [userEmail]);
    const userId = userIdResult.rows[0].id;
    bookingId = await createTestBooking(pool, eventId, userId, 1);
    await pool.query('UPDATE events SET booked_count = 1 WHERE id = $1', [eventId]);
    setupComplete = true;
  }, HOOK_TIMEOUT);

  afterAll(async () => {
    if (!setupComplete || !pool) return;
    await deleteBooking(pool, bookingId);
    await deleteEvent(pool, eventId);
    const userRow = await pool.query('SELECT id FROM users WHERE email = $1', [userEmail]);
    if (userRow.rows[0]) await deleteUser(pool, userRow.rows[0].id);
  });

  it('GET /api/v1/bookings without auth returns 401', async () => {
    const res = await agent.get('/api/v1/bookings');
    expectError(res, 401, EVB401001);
  }, TEST_TIMEOUT);

  it('GET /api/v1/bookings with auth returns 200 with data and pagination', async () => {
    const res = await agent
      .get('/api/v1/bookings')
      .set(authHeader(userTokens.access_token));
    expectSuccess(res, 200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expectPagination(res);
  }, TEST_TIMEOUT);

  it('GET /api/v1/bookings/:id without auth returns 401', async () => {
    const res = await agent.get(`/api/v1/bookings/${bookingId}`);
    expectError(res, 401, EVB401001);
  }, TEST_TIMEOUT);

  it('GET /api/v1/bookings/:id with auth returns 200 with booking data', async () => {
    const res = await agent
      .get(`/api/v1/bookings/${bookingId}`)
      .set(authHeader(userTokens.access_token));
    expectSuccessWithData(res, 200, ['id', 'event_id', 'user_id', 'ticket_count', 'status']);
    expect(res.body.data.id).toBe(bookingId);
    expect(res.body.data.status).toBe('confirmed');
  }, TEST_TIMEOUT);

  it('GET /api/v1/bookings/999999 returns 404', async () => {
    const res = await agent
      .get('/api/v1/bookings/999999')
      .set(authHeader(userTokens.access_token));
    expectError(res, 404, EVB404001);
  }, TEST_TIMEOUT);

  it('PATCH /api/v1/bookings/:id without auth returns 401', async () => {
    const res = await agent
      .patch(`/api/v1/bookings/${bookingId}`)
      .send({ status: 'cancelled' });
    expectError(res, 401, EVB401001);
  }, TEST_TIMEOUT);

  it('PATCH /api/v1/bookings/:id with auth cancels booking and returns 200', async () => {
    const res = await agent
      .patch(`/api/v1/bookings/${bookingId}`)
      .set(authHeader(userTokens.access_token))
      .send({ status: 'cancelled' });
    expectSuccessWithData(res, 200, ['id', 'status']);
    expect(res.body.data.status).toBe('cancelled');
  }, TEST_TIMEOUT);

  it('PATCH /api/v1/bookings/999999 returns 404', async () => {
    const res = await agent
      .patch('/api/v1/bookings/999999')
      .set(authHeader(userTokens.access_token))
      .send({ status: 'cancelled' });
    expectError(res, 404, EVB404001);
  }, TEST_TIMEOUT);
});
