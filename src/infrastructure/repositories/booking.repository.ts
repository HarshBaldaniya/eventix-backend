// Booking repository - implements IBookingRepository
import { PoolClient } from 'pg';
import { IBookingRepository } from '../../domain/interfaces/booking.repository.interface';
import { BookingEntity } from '../../domain/entities/booking.entity';
import { getPostgresPool } from '../database/postgres.client';
import { BOOKING_QUERIES } from '../database/queries/booking.queries';
import { appLogger } from '../../shared/logger/app.logger';
import { LOG_LABEL } from '../../shared/constants/log-label.constants';

const logLabel = LOG_LABEL.INFRASTRUCTURE;

function rowToBooking(row: Record<string, unknown>): BookingEntity {
  return {
    id: Number(row.id),
    event_id: Number(row.event_id),
    user_id: Number(row.user_id),
    ticket_count: Number(row.ticket_count ?? 1),
    status: row.status as 'confirmed' | 'cancelled',
    created_at: row.created_at as Date,
    updated_at: row.updated_at as Date,
  };
}

export class BookingRepository implements IBookingRepository {
  async create(eventId: number, userId: number, ticketCount: number, client: unknown): Promise<BookingEntity> {
    try {
      const c = client as PoolClient;
      const result = await c.query(BOOKING_QUERIES.INSERT, [eventId, userId, ticketCount]);
      const row = result.rows[0];
      return rowToBooking(row);
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'BookingRepository.create failed', err });
      throw err;
    }
  }

  async findAll(page: number, limit: number): Promise<{ bookings: BookingEntity[]; total: number }> {
    try {
      const pool = await getPostgresPool();
      const offset = (page - 1) * limit;
      const [bookingsResult, countResult] = await Promise.all([
        pool.query(BOOKING_QUERIES.SELECT_ALL, [limit, offset]),
        pool.query(BOOKING_QUERIES.COUNT_ALL),
      ]);
      const bookings = bookingsResult.rows.map(rowToBooking);
      const total = Number(countResult.rows[0]?.total ?? 0);
      return { bookings, total };
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'BookingRepository.findAll failed', err });
      throw err;
    }
  }

  async findByUserId(
    userId: number,
    page: number,
    limit: number
  ): Promise<{ bookings: BookingEntity[]; total: number }> {
    try {
      const pool = await getPostgresPool();
      const offset = (page - 1) * limit;
      const [bookingsResult, countResult] = await Promise.all([
        pool.query(BOOKING_QUERIES.SELECT_BY_USER, [userId, limit, offset]),
        pool.query(BOOKING_QUERIES.COUNT_BY_USER, [userId]),
      ]);
      const bookings = bookingsResult.rows.map(rowToBooking);
      const total = Number(countResult.rows[0]?.total ?? 0);
      return { bookings, total };
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'BookingRepository.findByUserId failed', err });
      throw err;
    }
  }

  async findById(id: number): Promise<BookingEntity | null> {
    try {
      const pool = await getPostgresPool();
      const result = await pool.query(BOOKING_QUERIES.SELECT_BY_ID, [id]);
      const row = result.rows[0];
      if (!row) return null;
      return rowToBooking(row);
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'BookingRepository.findById failed', err });
      throw err;
    }
  }

  async lockForUpdate(id: number, client: unknown): Promise<BookingEntity | null> {
    try {
      const c = client as PoolClient;
      const result = await c.query(BOOKING_QUERIES.LOCK_FOR_UPDATE, [id]);
      const row = result.rows[0];
      if (!row) return null;
      return rowToBooking(row);
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'BookingRepository.lockForUpdate failed', err });
      throw err;
    }
  }

  async sumTicketsByUserForEvent(eventId: number, userId: number, client: unknown): Promise<number> {
    try {
      const c = client as PoolClient;
      const result = await c.query(BOOKING_QUERIES.SUM_TICKETS_BY_USER_EVENT, [eventId, userId]);
      return Number(result.rows[0]?.total ?? 0);
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'BookingRepository.sumTicketsByUserForEvent failed', err });
      throw err;
    }
  }

  async updateStatus(id: number, status: 'cancelled', client: unknown): Promise<BookingEntity> {
    try {
      const c = client as PoolClient;
      const result = await c.query(BOOKING_QUERIES.UPDATE_STATUS, [status, id]);
      const row = result.rows[0];
      if (!row) throw new Error('Update returned no row');
      return rowToBooking(row);
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'BookingRepository.updateStatus failed', err });
      throw err;
    }
  }
}
