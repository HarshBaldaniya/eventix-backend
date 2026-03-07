// Booking audit log SQL queries - operation/outcome use audit_operation_enum, audit_outcome_enum
export const BOOKING_AUDIT_QUERIES = {
  INSERT: `INSERT INTO booking_audit_log (operation, event_id, booking_id, user_id, ticket_count, outcome, details, error_code, error_message)
    VALUES ($1::audit_operation_enum, $2, $3, $4, $5, $6::audit_outcome_enum, $7, $8, $9)`,
} as const;

export function buildBookingAuditListQuery(filters: {
  event_id?: number;
  booking_id?: number;
  outcome?: string;
  date_from?: Date;
  date_to?: Date;
  page: number;
  limit: number;
}): { sql: string; params: unknown[] } {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.event_id != null) {
    conditions.push(`event_id = $${paramIndex++}`);
    params.push(filters.event_id);
  }
  if (filters.booking_id != null) {
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

  const offset = (filters.page - 1) * filters.limit;
  params.push(filters.limit, offset);

  const where = conditions.join(' AND ');
  const sql = `SELECT id, operation, event_id, booking_id, user_id, ticket_count, outcome, details, error_code, error_message, created_at
    FROM booking_audit_log
    WHERE ${where}
    ORDER BY created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  return { sql, params };
}

export function buildBookingAuditCountQuery(filters: {
  event_id?: number;
  booking_id?: number;
  outcome?: string;
  date_from?: Date;
  date_to?: Date;
}): { sql: string; params: unknown[] } {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.event_id != null) {
    conditions.push(`event_id = $${paramIndex++}`);
    params.push(filters.event_id);
  }
  if (filters.booking_id != null) {
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

  const where = conditions.join(' AND ');
  const sql = `SELECT COUNT(*)::int AS total FROM booking_audit_log WHERE ${where}`;
  return { sql, params };
}
