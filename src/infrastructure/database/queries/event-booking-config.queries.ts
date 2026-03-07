// Event booking config queries - default + per-event overrides
export const EVENT_BOOKING_CONFIG_QUERIES = {
  /** Get config for event: event-specific first, else default (event_id IS NULL). ORDER BY puts event_id first. */
  SELECT_FOR_EVENT: `SELECT max_tickets_per_booking, max_tickets_per_user
    FROM event_booking_config
    WHERE event_id = $1 OR event_id IS NULL
    ORDER BY event_id DESC NULLS LAST
    LIMIT 1`,
} as const;
