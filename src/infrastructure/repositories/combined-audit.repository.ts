// Combined audit repository - UNION of event_audit_log and booking_audit_log
import {
  ICombinedAuditRepository,
  CombinedAuditListFilters,
} from '../../domain/interfaces/combined-audit.repository.interface';
import type { CombinedAuditEntity } from '../../domain/interfaces/combined-audit.repository.interface';
import { getPostgresPool } from '../database/postgres.client';
import { buildCombinedAuditListQuery, buildCombinedAuditCountQuery } from '../database/queries/combined-audit.queries';
import type { CombinedAuditFilters } from '../database/queries/combined-audit.queries';
import { appLogger } from '../../shared/logger/app.logger';
import { LOG_LABEL } from '../../shared/constants/log-label.constants';

const logLabel = LOG_LABEL.INFRASTRUCTURE;

function rowToCombinedAudit(row: Record<string, unknown>): CombinedAuditEntity {
  return {
    id: Number(row.id),
    resource_type: row.resource_type as 'event' | 'booking',
    operation: String(row.operation) as CombinedAuditEntity['operation'],
    event_id: Number(row.event_id),
    booking_id: row.booking_id != null ? Number(row.booking_id) : null,
    ticket_count: row.ticket_count != null ? Number(row.ticket_count) : null,
    user_id: row.user_id != null ? Number(row.user_id) : null,
    outcome: String(row.outcome) as CombinedAuditEntity['outcome'],
    details: row.details != null ? (row.details as Record<string, unknown>) : null,
    error_code: row.error_code != null ? String(row.error_code) : null,
    error_message: row.error_message != null ? String(row.error_message) : null,
    created_at: row.created_at as Date,
  };
}

export class CombinedAuditRepository implements ICombinedAuditRepository {
  async findAll(filters: CombinedAuditListFilters): Promise<{ logs: CombinedAuditEntity[]; total: number }> {
    try {
      const pool = await getPostgresPool();
      const queryFilters: CombinedAuditFilters = {
        resource_type: filters.resource_type,
        event_id: filters.event_id,
        booking_id: filters.booking_id,
        outcome: filters.outcome,
        date_from: filters.date_from,
        date_to: filters.date_to,
        page: filters.page,
        limit: filters.limit,
      };
      const { sql: listSql, params: listParams } = buildCombinedAuditListQuery(queryFilters);
      const countFilters: Omit<CombinedAuditFilters, 'page' | 'limit'> = {
        resource_type: filters.resource_type,
        event_id: filters.event_id,
        booking_id: filters.booking_id,
        outcome: filters.outcome,
        date_from: filters.date_from,
        date_to: filters.date_to,
      };
      const { sql: countSql, params: countParams } = buildCombinedAuditCountQuery({
        ...countFilters,
        page: 1,
        limit: 10,
      });
      const [logsResult, countResult] = await Promise.all([
        pool.query(listSql, listParams),
        pool.query(countSql, countParams),
      ]);
      const logs = logsResult.rows.map(rowToCombinedAudit);
      const total = Number(countResult.rows[0]?.total ?? 0);
      return { logs, total };
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'CombinedAuditRepository.findAll failed', err });
      throw err;
    }
  }
}
