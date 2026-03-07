// Booking audit repository - implements IBookingAuditRepository
import { PoolClient } from 'pg';
import {
  IBookingAuditRepository,
  BookingAuditInsert,
  BookingAuditListFilters,
} from '../../domain/interfaces/booking-audit.repository.interface';
import type { BookingAuditEntity } from '../../domain/interfaces/booking-audit.repository.interface';
import { getPostgresPool } from '../database/postgres.client';
import { BOOKING_AUDIT_QUERIES, buildBookingAuditListQuery, buildBookingAuditCountQuery } from '../database/queries/booking-audit.queries';
import { appLogger } from '../../shared/logger/app.logger';
import { LOG_LABEL } from '../../shared/constants/log-label.constants';

const logLabel = LOG_LABEL.INFRASTRUCTURE;

function rowToBookingAudit(row: Record<string, unknown>): BookingAuditEntity {
  return {
    id: Number(row.id),
    operation: String(row.operation) as BookingAuditEntity['operation'],
    event_id: Number(row.event_id),
    booking_id: row.booking_id != null ? Number(row.booking_id) : null,
    user_id: row.user_id != null ? Number(row.user_id) : null,
    ticket_count: row.ticket_count != null ? Number(row.ticket_count) : null,
    outcome: String(row.outcome) as BookingAuditEntity['outcome'],
    details: row.details != null ? (row.details as Record<string, unknown>) : null,
    error_code: row.error_code != null ? String(row.error_code) : null,
    error_message: row.error_message != null ? String(row.error_message) : null,
    created_at: row.created_at as Date,
  };
}

export class BookingAuditRepository implements IBookingAuditRepository {
  async insert(data: BookingAuditInsert, client?: unknown): Promise<void> {
    try {
      const params = [
        data.operation,
        data.event_id,
        data.booking_id ?? null,
        data.user_id ?? null,
        data.ticket_count ?? null,
        data.outcome,
        data.details != null ? JSON.stringify(data.details) : null,
        data.error_code ?? null,
        data.error_message ?? null,
      ];
      if (client) {
        const c = client as PoolClient;
        await c.query(BOOKING_AUDIT_QUERIES.INSERT, params);
      } else {
        const pool = await getPostgresPool();
        await pool.query(BOOKING_AUDIT_QUERIES.INSERT, params);
      }
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'BookingAuditRepository.insert failed', err });
      throw err;
    }
  }

  async findAll(filters: BookingAuditListFilters): Promise<{ logs: BookingAuditEntity[]; total: number }> {
    try {
      const pool = await getPostgresPool();
      const listFilters = {
        event_id: filters.event_id,
        booking_id: filters.booking_id,
        outcome: filters.outcome,
        date_from: filters.date_from,
        date_to: filters.date_to,
        page: filters.page,
        limit: filters.limit,
      };
      const { sql: listSql, params: listParams } = buildBookingAuditListQuery(listFilters);
      const countFilters = {
        event_id: filters.event_id,
        booking_id: filters.booking_id,
        outcome: filters.outcome,
        date_from: filters.date_from,
        date_to: filters.date_to,
      };
      const { sql: countSql, params: countParams } = buildBookingAuditCountQuery(countFilters);
      const [logsResult, countResult] = await Promise.all([
        pool.query(listSql, listParams),
        pool.query(countSql, countParams),
      ]);
      const logs = logsResult.rows.map(rowToBookingAudit);
      const total = Number(countResult.rows[0]?.total ?? 0);
      return { logs, total };
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'BookingAuditRepository.findAll failed', err });
      throw err;
    }
  }
}
