// DB setup and cleanup helpers for API tests; requires config loaded first
import { getPostgresPool, closePostgresPool } from '../../src/infrastructure/database/postgres.client';
import { USER_QUERIES } from '../../src/infrastructure/database/queries/user.queries';
import { EVENT_QUERIES } from '../../src/infrastructure/database/queries/event.queries';
import { BOOKING_QUERIES } from '../../src/infrastructure/database/queries/booking.queries';
import * as bcrypt from 'bcrypt';

export type Pool = Awaited<ReturnType<typeof getPostgresPool>>;

export async function getPool(): Promise<Pool> {
  return getPostgresPool();
}

export async function closePool(): Promise<void> {
  return closePostgresPool();
}

export async function schemaExists(pool: Pool): Promise<boolean> {
  const check = await pool.query(
    "SELECT 1 FROM information_schema.tables WHERE table_name = 'events'"
  );
  return check.rows.length > 0;
}

export async function createTestUser(
  pool: Pool,
  email: string,
  password: string,
  role: 'user' | 'admin' = 'user',
  name?: string
): Promise<number> {
  const hash = await bcrypt.hash(password, 4);
  const result = await pool.query(USER_QUERIES.INSERT, [email, hash, name ?? null, role]);
  return result.rows[0].id;
}

// Create admin user for tests requiring admin role
export async function createAdminUser(
  pool: Pool,
  email: string,
  password: string,
  name?: string
): Promise<number> {
  return createTestUser(pool, email, password, 'admin', name);
}

export async function createTestEvent(
  pool: Pool,
  name: string,
  description: string,
  capacity: number,
  status: 'draft' | 'published' | 'coming_soon' | 'cancelled' | 'completed' = 'published'
): Promise<number> {
  const result = await pool.query(EVENT_QUERIES.INSERT, [name, description, capacity, status]);
  return result.rows[0].id;
}

export async function createTestBooking(
  pool: Pool,
  eventId: number,
  userId: number,
  ticketCount: number = 1
): Promise<number> {
  const result = await pool.query(BOOKING_QUERIES.INSERT, [eventId, userId, ticketCount]);
  return result.rows[0].id;
}

export async function deleteUser(pool: Pool, userId: number): Promise<void> {
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM bookings WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}

export async function deleteEvent(pool: Pool, eventId: number): Promise<void> {
  await pool.query('DELETE FROM bookings WHERE event_id = $1', [eventId]);
  await pool.query('DELETE FROM events WHERE id = $1', [eventId]);
}

export async function deleteBooking(pool: Pool, bookingId: number): Promise<void> {
  await pool.query('DELETE FROM bookings WHERE id = $1', [bookingId]);
}

// Test event names used by API/integration tests - used for cleanup
export const TEST_EVENT_NAMES = [
  'Bookings Test Event',
  'API Test Event',
  'Booking Test Event',
  'Integration Event',
  'Small Event',
  'Admin Created Event',
  'Integration Full Flow Event',
  'Audit Test Event',
] as const;

// Cleans all test data: events first (cascades to bookings, event_audit_log, booking_audit_log), then users (cascades to sessions)
export async function cleanAllTestData(pool: Pool): Promise<{ eventsDeleted: number; usersDeleted: number }> {
  const eventResult = await pool.query(
    `DELETE FROM events WHERE name = ANY($1::text[]) RETURNING id`,
    [[...TEST_EVENT_NAMES]]
  );
  const userResult = await pool.query(
    "DELETE FROM users WHERE email LIKE '%@test.local' RETURNING id"
  );
  return {
    eventsDeleted: eventResult.rowCount ?? 0,
    usersDeleted: userResult.rowCount ?? 0,
  };
}
