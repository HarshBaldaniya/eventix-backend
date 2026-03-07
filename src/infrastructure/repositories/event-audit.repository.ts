// Event audit repository - implements IEventAuditRepository
import { PoolClient } from 'pg';
import {
  IEventAuditRepository,
  EventAuditInsert,
  EventAuditListFilters,
} from '../../domain/interfaces/event-audit.repository.interface';
import type { EventAuditEntity } from '../../domain/interfaces/event-audit.repository.interface';
import { getPostgresPool } from '../database/postgres.client';
import { EVENT_AUDIT_QUERIES, buildEventAuditListQuery, buildEventAuditCountQuery } from '../database/queries/event-audit.queries';
import { appLogger } from '../../shared/logger/app.logger';
import { LOG_LABEL } from '../../shared/constants/log-label.constants';

const logLabel = LOG_LABEL.INFRASTRUCTURE;

function rowToEventAudit(row: Record<string, unknown>): EventAuditEntity {
  return {
    id: Number(row.id),
    operation: String(row.operation) as EventAuditEntity['operation'],
    event_id: Number(row.event_id),
    user_id: row.user_id != null ? Number(row.user_id) : null,
    outcome: String(row.outcome) as EventAuditEntity['outcome'],
    details: row.details != null ? (row.details as Record<string, unknown>) : null,
    error_code: row.error_code != null ? String(row.error_code) : null,
    error_message: row.error_message != null ? String(row.error_message) : null,
    created_at: row.created_at as Date,
  };
}

export class EventAuditRepository implements IEventAuditRepository {
  async insert(data: EventAuditInsert, client?: unknown): Promise<void> {
    try {
      const params = [
        data.operation,
        data.event_id,
        data.user_id ?? null,
        data.outcome,
        data.details != null ? JSON.stringify(data.details) : null,
        data.error_code ?? null,
        data.error_message ?? null,
      ];
      if (client) {
        const c = client as PoolClient;
        await c.query(EVENT_AUDIT_QUERIES.INSERT, params);
      } else {
        const pool = await getPostgresPool();
        await pool.query(EVENT_AUDIT_QUERIES.INSERT, params);
      }
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'EventAuditRepository.insert failed', err });
      throw err;
    }
  }

  async findAll(filters: EventAuditListFilters): Promise<{ logs: EventAuditEntity[]; total: number }> {
    try {
      const pool = await getPostgresPool();
      const listFilters = {
        event_id: filters.event_id,
        outcome: filters.outcome,
        date_from: filters.date_from,
        date_to: filters.date_to,
        page: filters.page,
        limit: filters.limit,
      };
      const { sql: listSql, params: listParams } = buildEventAuditListQuery(listFilters);
      const countFilters = {
        event_id: filters.event_id,
        outcome: filters.outcome,
        date_from: filters.date_from,
        date_to: filters.date_to,
      };
      const { sql: countSql, params: countParams } = buildEventAuditCountQuery(countFilters);
      const [logsResult, countResult] = await Promise.all([
        pool.query(listSql, listParams),
        pool.query(countSql, countParams),
      ]);
      const logs = logsResult.rows.map(rowToEventAudit);
      const total = Number(countResult.rows[0]?.total ?? 0);
      return { logs, total };
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'EventAuditRepository.findAll failed', err });
      throw err;
    }
  }
}
