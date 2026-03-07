// Integration: Event and booking in DB, API returns correct data. Run: npm run test:all
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPool, schemaExists, createTestEvent, createTestUser, createTestBooking, deleteEvent, deleteUser, deleteBooking } from '../helpers/db-setup';
import { getTestAgent } from '../helpers/test-app';
import { authHeader } from '../helpers/auth-helper';
import { expectSuccessWithData } from '../helpers/response-assertions';

const HOOK_TIMEOUT = 15_000;

describe('Booking integration - event and booking data in DB', () => {
  let eventId: number;
  let userId: number;
  let bookingId: number;
  let pool: Awaited<ReturnType<typeof getPool>>;
  let userEmail: string;
  let setupComplete = false;

  beforeAll(async () => {
    getTestAgent();
    pool = await getPool();
    if (!(await schemaExists(pool))) {
      throw new Error('DB schema not initialized. Run: npm run db:init');
    }
    userEmail = `integration-${Date.now()}@test.local`;
    userId = await createTestUser(pool, userEmail, 'Pass123');
    eventId = await createTestEvent(pool, 'Integration Event', 'Test event with booking', 10, 'published');
    bookingId = await createTestBooking(pool, eventId, userId, 2);
    await pool.query('UPDATE events SET booked_count = 2 WHERE id = $1', [eventId]);
    setupComplete = true;
  }, HOOK_TIMEOUT);

  afterAll(async () => {
    if (!setupComplete || !pool) return;
    await deleteBooking(pool, bookingId);
    await deleteEvent(pool, eventId);
    await deleteUser(pool, userId);
  });

  it('event exists in DB with correct capacity and booked_count', async () => {
    const row = await pool.query('SELECT id, name, capacity, booked_count FROM events WHERE id = $1', [eventId]);
    expect(row.rows.length).toBe(1);
    expect(row.rows[0].name).toBe('Integration Event');
    expect(Number(row.rows[0].capacity)).toBe(10);
    expect(Number(row.rows[0].booked_count)).toBe(2);
  });

  it('booking exists in DB with correct ticket_count and status', async () => {
    const row = await pool.query('SELECT id, event_id, user_id, ticket_count, status FROM bookings WHERE id = $1', [bookingId]);
    expect(row.rows.length).toBe(1);
    expect(row.rows[0].event_id).toBe(eventId);
    expect(row.rows[0].user_id).toBe(userId);
    expect(Number(row.rows[0].ticket_count)).toBe(2);
    expect(row.rows[0].status).toBe('confirmed');
  });

  it('GET /api/v1/events/:id returns event with remaining_spots', async () => {
    const agent = getTestAgent();
    const res = await agent.get(`/api/v1/events/${eventId}`);
    expectSuccessWithData(res, 200, ['id', 'name', 'capacity', 'booked_count', 'remaining_spots', 'status']);
    expect(res.body.data.remaining_spots).toBe(8);
    expect(res.body.data.booked_count).toBe(2);
  });

  it('user can fetch own booking via API after login', async () => {
    const agent = getTestAgent();
    const loginRes = await agent.post('/api/v1/auth/login').send({ email: userEmail, password: 'Pass123' });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.data.access_token;
    const res = await agent.get(`/api/v1/bookings/${bookingId}`).set(authHeader(token));
    expectSuccessWithData(res, 200, ['id', 'event_id', 'user_id', 'ticket_count', 'status']);
    expect(res.body.data.id).toBe(bookingId);
    expect(res.body.data.ticket_count).toBe(2);
  });
});
