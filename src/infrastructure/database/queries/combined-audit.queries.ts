// Combined audit queries - UNION of event_audit_log and booking_audit_log for list API
export interface CombinedAuditFilters {
  resource_type?: 'event' | 'booking';
  event_id?: number;
  booking_id?: number;
  outcome?: string;
  date_from?: Date;
  date_to?: Date;
  page: number;
  limit: number;
}

function buildWhereClause(
  table: 'event' | 'booking',
  filters: CombinedAuditFilters
): { conditions: string[]; params: unknown[] } {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.event_id != null) {
    conditions.push(`event_id = $${paramIndex++}`);
    params.push(filters.event_id);
  }
  if (filters.booking_id != null && table === 'booking') {
    conditions.push(`booking_id = $${paramIndex++}`);
    params.push(filters.booking_id);
  }
  if (filters.outcome) {
    conditions.push(`outcome = $${paramIndex++}`);
    params.push(filters.outcome);
  }
  if (filters.date_from) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filters.date_to);
  }

  return { conditions, params };
}

export function buildCombinedAuditListQuery(filters: CombinedAuditFilters): {
  sql: string;
  params: unknown[];
} {
  const { resource_type } = filters;
  const limit = filters.limit ?? 10;
  const offset = ((filters.page ?? 1) - 1) * limit;

  if (resource_type === 'event') {
    const { conditions, params } = buildWhereClause('event', filters);
    const where = conditions.join(' AND ');
    params.push(limit, offset);
    const sql = `SELECT id, 'event'::text AS resource_type, operation, event_id, NULL::int AS booking_id, NULL::int AS ticket_count, user_id, outcome, details, error_code, error_message, created_at
      FROM event_audit_log
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`;
    return { sql, params };
  }

  if (resource_type === 'booking' || filters.booking_id != null) {
    const { conditions, params } = buildWhereClause('booking', filters);
    const where = conditions.join(' AND ');
    params.push(limit, offset);
    const sql = `SELECT id, 'booking'::text AS resource_type, operation, event_id, booking_id, ticket_count, user_id, outcome, details, error_code, error_message, created_at
      FROM booking_audit_log
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`;
    return { sql, params };
  }

  const eventWhere = buildWhereClause('event', filters);
  const bookingWhere = buildWhereClause('booking', filters);
  const paramOffset = eventWhere.params.length;
  const bookingWhereStr = bookingWhere.conditions
    .map((c) => c.replace(/\$(\d+)/g, (_, n) => `$${paramOffset + parseInt(n, 10)}`))
    .join(' AND ');
  const eventWhereStr = eventWhere.conditions.join(' AND ');
  const allParams = [...eventWhere.params, ...bookingWhere.params, limit, offset];
  const limitParam = allParams.length - 1;
  const offsetParam = allParams.length;

  const sql = `(
    SELECT id, 'event'::text AS resource_type, operation, event_id, NULL::int AS booking_id, NULL::int AS ticket_count, user_id, outcome, details, error_code, error_message, created_at
    FROM event_audit_log
    WHERE ${eventWhereStr}
  )
  UNION ALL
  (
    SELECT id, 'booking'::text AS resource_type, operation, event_id, booking_id, ticket_count, user_id, outcome, details, error_code, error_message, created_at
    FROM booking_audit_log
    WHERE ${bookingWhereStr}
  )
  ORDER BY created_at DESC
  LIMIT $${limitParam} OFFSET $${offsetParam}`;
  return { sql, params: allParams };
}

export function buildCombinedAuditCountQuery(filters: CombinedAuditFilters): {
  sql: string;
  params: unknown[];
} {
  const { resource_type } = filters;

  if (resource_type === 'event') {
    const { conditions, params } = buildWhereClause('event', filters);
    const where = conditions.join(' AND ');
    const sql = `SELECT COUNT(*)::int AS total FROM event_audit_log WHERE ${where}`;
    return { sql, params };
  }

  if (resource_type === 'booking' || filters.booking_id != null) {
    const { conditions, params } = buildWhereClause('booking', filters);
    const where = conditions.join(' AND ');
    const sql = `SELECT COUNT(*)::int AS total FROM booking_audit_log WHERE ${where}`;
    return { sql, params };
  }

  const eventWhere = buildWhereClause('event', filters);
  const bookingWhere = buildWhereClause('booking', filters);
  const paramOffset = eventWhere.params.length;
  const bookingWhereStr = bookingWhere.conditions
    .map((c) => c.replace(/\$(\d+)/g, (_, n) => `$${paramOffset + parseInt(n, 10)}`))
    .join(' AND ');
  const eventWhereStr = eventWhere.conditions.join(' AND ');
  const allParams = [...eventWhere.params, ...bookingWhere.params];

  const sql = `SELECT (SELECT COUNT(*)::int FROM event_audit_log WHERE ${eventWhereStr}) + (SELECT COUNT(*)::int FROM booking_audit_log WHERE ${bookingWhereStr}) AS total`;
  return { sql, params: allParams };
}
