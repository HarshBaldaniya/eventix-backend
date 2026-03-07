// Event repository - implements IEventRepository
import { PoolClient } from 'pg';
import { IEventRepository, EventListOptions } from '../../domain/interfaces/event.repository.interface';
import { EventEntity } from '../../domain/entities/event.entity';
import { getPostgresPool } from '../database/postgres.client';
import { EVENT_QUERIES, buildListQuery } from '../database/queries/event.queries';
import { appLogger } from '../../shared/logger/app.logger';
import { LOG_LABEL } from '../../shared/constants/log-label.constants';

const logLabel = LOG_LABEL.INFRASTRUCTURE;

function rowToEvent(row: Record<string, unknown>): EventEntity {
  const capacity = Number(row.capacity);
  const bookedCount = Number(row.booked_count);
  return {
    id: Number(row.id),
    name: String(row.name),
    description: row.description != null ? String(row.description) : null,
    capacity,
    booked_count: bookedCount,
    remaining_spots: capacity - bookedCount,
    status: (row.status as EventEntity['status']) ?? 'published',
    created_at: row.created_at as Date,
  };
}

export class EventRepository implements IEventRepository {
  async findAll(options: EventListOptions): Promise<{ events: EventEntity[]; total: number }> {
    try {
      const pool = await getPostgresPool();
      const { page, limit, search, statuses, sortBy, order } = options;
      const offset = (page - 1) * limit;
      const searchPattern = search?.trim() ? `%${search.trim()}%` : null;
      const statusFilter = statuses && statuses.length > 0 ? statuses : null;
      const selectQuery = buildListQuery(sortBy, order);
      const params = [searchPattern, statusFilter, limit, offset];
      const [eventsResult, countResult] = await Promise.all([
        pool.query(selectQuery, params),
        pool.query(EVENT_QUERIES.COUNT_ALL_FILTERED, [searchPattern, statusFilter]),
      ]);
      const events = eventsResult.rows.map(rowToEvent);
      const total = Number(countResult.rows[0]?.total ?? 0);
      return { events, total };
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'EventRepository.findAll failed', err });
      throw err;
    }
  }

  async findById(id: number): Promise<EventEntity | null> {
    try {
      const pool = await getPostgresPool();
      const result = await pool.query(EVENT_QUERIES.SELECT_BY_ID, [id]);
      const row = result.rows[0];
      if (!row) return null;
      return rowToEvent(row);
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'EventRepository.findById failed', err });
      throw err;
    }
  }

  async findByIdWithClient(id: number, client: unknown): Promise<EventEntity | null> {
    try {
      const c = client as PoolClient;
      const result = await c.query(EVENT_QUERIES.SELECT_BY_ID, [id]);
      const row = result.rows[0];
      if (!row) return null;
      return rowToEvent(row);
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'EventRepository.findByIdWithClient failed', err });
      throw err;
    }
  }

  async lockForUpdate(id: number, client: unknown): Promise<EventEntity | null> {
    try {
      const c = client as PoolClient;
      const result = await c.query(EVENT_QUERIES.LOCK_FOR_UPDATE, [id]);
      const row = result.rows[0];
      if (!row) return null;
      return rowToEvent(row);
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'EventRepository.lockForUpdate failed', err });
      throw err;
    }
  }

  async reserveSpots(id: number, ticketCount: number, client: unknown): Promise<EventEntity | null> {
    try {
      const c = client as PoolClient;
      const result = await c.query(EVENT_QUERIES.RESERVE_SPOTS, [id, ticketCount]);
      const row = result.rows[0];
      if (!row) return null;
      return rowToEvent(row);
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'EventRepository.reserveSpots failed', err });
      throw err;
    }
  }

  async incrementBookedCount(id: number, amount: number, client: unknown): Promise<void> {
    try {
      const c = client as PoolClient;
      await c.query(EVENT_QUERIES.INCREMENT_BOOKED, [id, amount]);
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'EventRepository.incrementBookedCount failed', err });
      throw err;
    }
  }

  async decrementBookedCount(id: number, amount: number, client: unknown): Promise<void> {
    try {
      const c = client as PoolClient;
      await c.query(EVENT_QUERIES.DECREMENT_BOOKED, [id, amount]);
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'EventRepository.decrementBookedCount failed', err });
      throw err;
    }
  }

  async create(input: { name: string; description?: string | null; capacity: number; status?: string }): Promise<EventEntity> {
    try {
      const pool = await getPostgresPool();
      const status = input.status ?? 'draft';
      const result = await pool.query(EVENT_QUERIES.INSERT, [
        input.name,
        input.description ?? null,
        input.capacity,
        status,
      ]);
      const row = result.rows[0];
      return rowToEvent(row);
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'EventRepository.create failed', err });
      throw err;
    }
  }

  async createWithClient(input: { name: string; description?: string | null; capacity: number; status?: string }, client: unknown): Promise<EventEntity> {
    try {
      const c = client as PoolClient;
      const status = input.status ?? 'draft';
      const result = await c.query(EVENT_QUERIES.INSERT, [
        input.name,
        input.description ?? null,
        input.capacity,
        status,
      ]);
      const row = result.rows[0];
      return rowToEvent(row);
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'EventRepository.createWithClient failed', err });
      throw err;
    }
  }

  async update(
    id: number,
    input: { name?: string; description?: string | null; capacity?: number; status?: string }
  ): Promise<EventEntity | null> {
    try {
      const pool = await getPostgresPool();
      const existing = await this.findById(id);
      if (!existing) return null;
      const name = input.name ?? existing.name;
      const description = input.description !== undefined ? input.description : existing.description;
      const capacity = input.capacity ?? existing.capacity;
      const status = input.status ?? existing.status;
      const result = await pool.query(EVENT_QUERIES.UPDATE, [
        name,
        description,
        capacity,
        id,
        status,
      ]);
      const row = result.rows[0];
      if (!row) return null;
      return rowToEvent(row);
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'EventRepository.update failed', err });
      throw err;
    }
  }

  async updateWithClient(
    id: number,
    input: { name?: string; description?: string | null; capacity?: number; status?: string },
    client: unknown
  ): Promise<EventEntity | null> {
    try {
      const c = client as PoolClient;
      const existing = await this.findByIdWithClient(id, client);
      if (!existing) return null;
      const name = input.name ?? existing.name;
      const description = input.description !== undefined ? input.description : existing.description;
      const capacity = input.capacity ?? existing.capacity;
      const status = input.status ?? existing.status;
      const result = await c.query(EVENT_QUERIES.UPDATE, [
        name,
        description,
        capacity,
        id,
        status,
      ]);
      const row = result.rows[0];
      if (!row) return null;
      return rowToEvent(row);
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'EventRepository.updateWithClient failed', err });
      throw err;
    }
  }
}
