// Event audit log SQL queries - operation/outcome use audit_operation_enum, audit_outcome_enum
export const EVENT_AUDIT_QUERIES = {
  INSERT: `INSERT INTO event_audit_log (operation, event_id, user_id, outcome, details, error_code, error_message)
    VALUES ($1::audit_operation_enum, $2, $3, $4::audit_outcome_enum, $5, $6, $7)`,
} as const;

export function buildEventAuditListQuery(filters: {
  event_id?: number;
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
  const limit = filters.limit ?? 10;
  const offset = ((filters.page ?? 1) - 1) * limit;
  params.push(limit, offset);
  const sql = `SELECT id, operation, event_id, user_id, outcome, details, error_code, error_message, created_at
    FROM event_audit_log
    WHERE ${where}
    ORDER BY created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  return { sql, params };
}

export function buildEventAuditCountQuery(filters: {
  event_id?: number;
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
  const sql = `SELECT COUNT(*)::int AS total FROM event_audit_log WHERE ${where}`;
  return { sql, params };
}
