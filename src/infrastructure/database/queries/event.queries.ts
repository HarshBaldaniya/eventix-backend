// Event-related SQL queries - repositories import from here
export const EVENT_QUERIES = {
  /** Consolidated query: $1=searchPattern|null, $2=statuses|null, $3=limit, $4=offset. NULL params skip filter. Cast status to text for enum=text[] comparison. */
  SELECT_ALL_FILTERED: `SELECT id, name, description, capacity, booked_count, status, created_at FROM events
    WHERE ($1::text IS NULL OR name ILIKE $1 OR description ILIKE $1)
      AND ($2::text[] IS NULL OR status::text = ANY($2))
    ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4`,
  COUNT_ALL_FILTERED: `SELECT COUNT(*)::int AS total FROM events
    WHERE ($1::text IS NULL OR name ILIKE $1 OR description ILIKE $1)
      AND ($2::text[] IS NULL OR status::text = ANY($2))`,
  SELECT_BY_ID: `SELECT id, name, description, capacity, booked_count, status, created_at FROM events WHERE id = $1`,
  LOCK_FOR_UPDATE: `SELECT id, name, description, capacity, booked_count, status, created_at FROM events WHERE id = $1 FOR UPDATE`,
  /** Atomic reserve: increments booked_count only if status=published and (capacity - booked_count) >= $2. Returns row or 0 rows. */
  RESERVE_SPOTS: `UPDATE events SET booked_count = booked_count + $2 WHERE id = $1 AND status = 'published' AND (capacity - booked_count) >= $2 RETURNING id, name, description, capacity, booked_count, status, created_at`,
  INCREMENT_BOOKED: `UPDATE events SET booked_count = booked_count + $2 WHERE id = $1`,
  DECREMENT_BOOKED: `UPDATE events SET booked_count = booked_count - $2 WHERE id = $1`,
  INSERT: `INSERT INTO events (name, description, capacity, status) VALUES ($1, $2, $3, $4) RETURNING id, name, description, capacity, booked_count, status, created_at`,
  UPDATE: `UPDATE events SET name = $1, description = $2, capacity = $3, status = COALESCE($5, status) WHERE id = $4 AND capacity >= booked_count RETURNING id, name, description, capacity, booked_count, status, created_at`,
} as const;

/** Whitelist for ORDER BY - prevents SQL injection. */
export const SORT_COLUMNS: Record<string, string> = {
  created_at: 'created_at',
  name: 'name',
  remaining_spots: '(capacity - booked_count)',
};

/** Builds SELECT query with dynamic ORDER BY. sortBy/order from whitelist only. */
export function buildListQuery(sortBy: string, order: 'asc' | 'desc'): string {
  const col = SORT_COLUMNS[sortBy] ?? 'created_at';
  const dir = order === 'asc' ? 'ASC' : 'DESC';
  return `SELECT id, name, description, capacity, booked_count, status, created_at FROM events
    WHERE ($1::text IS NULL OR name ILIKE $1 OR description ILIKE $1)
      AND ($2::text[] IS NULL OR status::text = ANY($2))
    ORDER BY ${col} ${dir}, id DESC LIMIT $3 OFFSET $4`;
}
