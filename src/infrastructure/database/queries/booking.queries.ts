// Booking-related SQL queries - repositories import from here
export const BOOKING_QUERIES = {
  INSERT: `INSERT INTO bookings (event_id, user_id, ticket_count, status) VALUES ($1, $2, $3, 'confirmed') RETURNING id, event_id, user_id, ticket_count, status, created_at, updated_at`,
  SELECT_BY_USER: `SELECT b.id, b.event_id, b.user_id, b.ticket_count, b.status, b.created_at, b.updated_at FROM bookings b WHERE b.user_id = $1 AND b.status = 'confirmed' ORDER BY b.created_at DESC LIMIT $2 OFFSET $3`,
  COUNT_BY_USER: `SELECT COUNT(*)::int AS total FROM bookings WHERE user_id = $1 AND status = 'confirmed'`,
  SELECT_BY_ID: `SELECT id, event_id, user_id, ticket_count, status, created_at, updated_at FROM bookings WHERE id = $1`,
  LOCK_FOR_UPDATE: `SELECT id, event_id, user_id, ticket_count, status, created_at, updated_at FROM bookings WHERE id = $1 FOR UPDATE`,
  UPDATE_STATUS: `UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, event_id, user_id, ticket_count, status, created_at, updated_at`,
  SELECT_ALL: `SELECT id, event_id, user_id, ticket_count, status, created_at, updated_at FROM bookings ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
  COUNT_ALL: `SELECT COUNT(*)::int AS total FROM bookings`,
  /** Sum of ticket_count for user's confirmed bookings for an event */
  SUM_TICKETS_BY_USER_EVENT: `SELECT COALESCE(SUM(ticket_count), 0)::int AS total FROM bookings WHERE event_id = $1 AND user_id = $2 AND status = 'confirmed'`,
} as const;
