// Event booking config repository - default + per-event overrides, in-memory TTL cache
import { IEventBookingConfigRepository } from '../../domain/interfaces/event-booking-config.repository.interface';
import { getPostgresPool } from '../database/postgres.client';
import { EVENT_BOOKING_CONFIG_QUERIES } from '../database/queries/event-booking-config.queries';
import { appLogger } from '../../shared/logger/app.logger';
import { LOG_LABEL } from '../../shared/constants/log-label.constants';

const logLabel = LOG_LABEL.INFRASTRUCTURE;
const DEFAULT_MAX_PER_BOOKING = 6;
const DEFAULT_MAX_PER_USER = 15;
const CACHE_TTL_MS = 60_000; // 60 seconds

interface CacheEntry {
  config: { max_tickets_per_booking: number; max_tickets_per_user: number };
  expiresAt: number;
}

export class EventBookingConfigRepository implements IEventBookingConfigRepository {
  private readonly cache = new Map<number, CacheEntry>();

  async getForEvent(eventId: number): Promise<{ max_tickets_per_booking: number; max_tickets_per_user: number }> {
    const now = Date.now();
    const entry = this.cache.get(eventId);
    if (entry && entry.expiresAt > now) {
      return entry.config;
    }
    try {
      const pool = await getPostgresPool();
      const result = await pool.query(EVENT_BOOKING_CONFIG_QUERIES.SELECT_FOR_EVENT, [eventId]);
      const row = result.rows[0];
      const config =
        !row
          ? { max_tickets_per_booking: DEFAULT_MAX_PER_BOOKING, max_tickets_per_user: DEFAULT_MAX_PER_USER }
          : {
              max_tickets_per_booking: Number(row.max_tickets_per_booking),
              max_tickets_per_user: Number(row.max_tickets_per_user),
            };
      this.cache.set(eventId, { config, expiresAt: now + CACHE_TTL_MS });
      return config;
    } catch (err) {
      appLogger.warn({ label: logLabel, msg: 'EventBookingConfigRepository.getForEvent failed, using defaults', err });
      return { max_tickets_per_booking: DEFAULT_MAX_PER_BOOKING, max_tickets_per_user: DEFAULT_MAX_PER_USER };
    }
  }
}
