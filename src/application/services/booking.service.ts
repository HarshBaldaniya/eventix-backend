// Booking service: Modular logic with SOLID principles and Self-Healing Redis
import { IEventRepository } from '../../domain/interfaces/event.repository.interface';
import { IBookingRepository } from '../../domain/interfaces/booking.repository.interface';
import { IBookingAuditRepository } from '../../domain/interfaces/booking-audit.repository.interface';
import { IEventBookingConfigRepository } from '../../domain/interfaces/event-booking-config.repository.interface';
import { ITransactionManager } from '../../domain/interfaces/transaction.interface';
import { getRedisClient, getEventSpotsKey } from '../../infrastructure/database/redis.client';
import { AppError } from '../../shared/errors/app.error';
import {
  STATUS_CODE_CONFLICT,
  STATUS_CODE_FORBIDDEN,
  STATUS_CODE_NOT_FOUND,
  STATUS_CODE_UNPROCESSABLE_ENTITY,
} from '../../shared/constants/status-code.constants';
import {
  EVB403001,
  EVB404001,
  EVB409001,
  EVB409004,
  EVB409005,
  EVB409006,
  EVB422001,
} from '../../shared/constants/error-code.constants';
import type { BookingResponseDto, BookingListDto, PaginationDto } from '../dtos/booking.dto';

const POSTGRES_DEADLOCK_CODE = '40P01';
const DEADLOCK_RETRY_ATTEMPTS = 3;
const DEADLOCK_RETRY_DELAY_MS = 50;

export class BookingService {
  constructor(
    private readonly transactionManager: ITransactionManager,
    private readonly eventRepo: IEventRepository,
    private readonly bookingRepo: IBookingRepository,
    private readonly bookingAuditRepo: IBookingAuditRepository,
    private readonly bookingConfigRepo: IEventBookingConfigRepository
  ) { }

  // Atomic Gatekeeping and Database Serializability
  async bookSpot(eventId: number, userId: number, ticketCount: number): Promise<BookingResponseDto> {
    const redis = getRedisClient();
    const redisKey = getEventSpotsKey(eventId);

    // Initial Redis Sync Check
    await this.ensureRedisSynced(eventId, redisKey);

    // High-Speed Filter with Self-Healing Logic
    let spotsLeft = await redis.decrby(redisKey, ticketCount);
    if (spotsLeft < 0) {
      const event = await this.eventRepo.findById(eventId);
      if (!event) {
        await redis.del(redisKey);
        throw new AppError('Event not found', STATUS_CODE_NOT_FOUND, EVB404001, { event_id: eventId });
      }

      if (event.remaining_spots >= ticketCount) {
        // Heal Redis if it was out of sync
        await redis.set(redisKey, event.remaining_spots - ticketCount);
      } else {
        await redis.incrby(redisKey, ticketCount);
        throw new AppError('Event is sold out', STATUS_CODE_CONFLICT, EVB409001, { event_id: eventId });
      }
    }

    // Database Transaction
    let booking;
    try {
      booking = await this.withDeadlockRetry(() =>
        this.transactionManager.executeInTransaction(async (client) => {
          const event = await this.eventRepo.lockForUpdate(eventId, client);
          if (!event) throw new AppError('Event not found', STATUS_CODE_NOT_FOUND, EVB404001);

          await this.validateBookingRules(event, userId, ticketCount, client);

          const reserved = await this.eventRepo.reserveSpots(eventId, ticketCount, client);
          if (!reserved) throw new AppError('Unable to reserve spots (Sold Out)', STATUS_CODE_CONFLICT, EVB409001);

          const created = await this.bookingRepo.create(eventId, userId, ticketCount, client);
          this.recordAudit(eventId, userId, ticketCount, 'success', { booking_id: created.id }, client);

          return created;
        })
      );
    } catch (err) {
      // Return spot to Redis if the DB transaction failed
      await redis.incrby(redisKey, ticketCount);
      throw err;
    }

    return this.toDto(booking);
  }

  // Defensive Redis Initialization
  private async ensureRedisSynced(eventId: number, key: string): Promise<void> {
    const redis = getRedisClient();
    if (await redis.exists(key)) return;

    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new AppError('Event not found', STATUS_CODE_NOT_FOUND, EVB404001);

    await redis.setnx(key, event.capacity - event.booked_count);
  }

  // SPIRIT Business Rule Validation
  private async validateBookingRules(event: any, userId: number, ticketCount: number, client?: any): Promise<void> {
    if (event.status !== 'published') {
      await this.reportFailure(event.id, userId, ticketCount, 'not_published', EVB409006, 'Not open.', client);
    }

    if (event.remaining_spots < ticketCount) {
      await this.reportFailure(event.id, userId, ticketCount, 'sold_out', EVB409001, 'Sold out.', client);
    }

    const config = await this.bookingConfigRepo.getForEvent(event.id);
    if (ticketCount > config.max_tickets_per_booking) {
      await this.reportFailure(event.id, userId, ticketCount, 'limit_req', EVB409004, 'Exceeds req limit.', client);
    }

    const currentBooked = await this.bookingRepo.sumTicketsByUserForEvent(event.id, userId, client);
    if (currentBooked + ticketCount > config.max_tickets_per_user) {
      await this.reportFailure(event.id, userId, ticketCount, 'limit_user', EVB409005, 'Exceeds user limit.', client);
    }
  }

  private async reportFailure(eventId: number, userId: number, count: number, reason: string, code: string, msg: string, client?: any): Promise<never> {
    this.recordAudit(eventId, userId, count, 'failure', { reason, error_code: code, error_message: msg }, client);
    throw new AppError(msg, STATUS_CODE_CONFLICT, code, { event_id: eventId });
  }

  private async recordAudit(eventId: number, userId: number, count: number, outcome: 'success' | 'failure', details: any, client?: any) {
    try {
      await this.bookingAuditRepo.insert({
        operation: 'book',
        event_id: eventId,
        booking_id: details.booking_id || null,
        user_id: userId,
        ticket_count: count,
        outcome,
        details,
        error_code: details.error_code,
        error_message: details.error_message
      }, client).catch(() => { }); // silent fail or use appLogger
    } catch (e) { /* silent fail or use appLogger */ }
  }

  async listBookings(userId: number, role: string, page: number, limit: number): Promise<BookingListDto> {
    const { bookings, total } = role === 'admin'
      ? await this.bookingRepo.findAll(page, limit)
      : await this.bookingRepo.findByUserId(userId, page, limit);
    const totalPages = Math.ceil(total / limit) || 1;
    return {
      bookings: bookings.map(this.toDto),
      pagination: {
        page, limit, total, total_pages: totalPages,
        has_next: page < totalPages, has_prev: page > 1
      }
    };
  }

  async getBookingById(id: number, userId: number, role: string): Promise<BookingResponseDto> {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) throw new AppError('Booking not found', STATUS_CODE_NOT_FOUND, EVB404001);
    if (role !== 'admin' && booking.user_id !== userId) throw new AppError('Forbidden', STATUS_CODE_FORBIDDEN, EVB403001);
    return this.toDto(booking);
  }

  async cancelBooking(bookingId: number, userId: number, role: string): Promise<BookingResponseDto> {
    return this.withDeadlockRetry(() =>
      this.transactionManager.executeInTransaction(async (client) => {
        const booking = await this.bookingRepo.lockForUpdate(bookingId, client);
        if (!booking) throw new AppError('Booking not found', STATUS_CODE_NOT_FOUND, EVB404001);
        if (role !== 'admin' && booking.user_id !== userId) throw new AppError('Forbidden', STATUS_CODE_FORBIDDEN, EVB403001);
        if (booking.status === 'cancelled') throw new AppError('Already cancelled', STATUS_CODE_UNPROCESSABLE_ENTITY, EVB422001);

        const event = await this.eventRepo.lockForUpdate(booking.event_id, client);
        if (!event) throw new AppError('Event not found', STATUS_CODE_NOT_FOUND, EVB404001);

        const updated = await this.bookingRepo.updateStatus(bookingId, 'cancelled', client);
        await this.eventRepo.decrementBookedCount(booking.event_id, booking.ticket_count, client);
        await getRedisClient().incrby(getEventSpotsKey(booking.event_id), booking.ticket_count);

        this.recordAudit(booking.event_id, userId, booking.ticket_count, 'success', { action: 'cancel' }, client);
        return updated;
      })
    ).then(b => this.toDto(b));
  }

  private async withDeadlockRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < DEADLOCK_RETRY_ATTEMPTS; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (!(err instanceof Error && 'code' in err && (err as any).code === POSTGRES_DEADLOCK_CODE) || attempt === DEADLOCK_RETRY_ATTEMPTS - 1) throw err;
        await new Promise(r => setTimeout(r, DEADLOCK_RETRY_DELAY_MS + Math.random() * 100));
      }
    }
    throw new Error('Retries exhausted');
  }

  private toDto(b: any): BookingResponseDto {
    if (!b) throw new Error('Booking object missing');
    return {
      id: b.id,
      event_id: b.event_id,
      user_id: b.user_id,
      ticket_count: b.ticket_count,
      status: b.status,
      created_at: (b.created_at instanceof Date ? b.created_at : new Date()).toISOString(),
      updated_at: (b.updated_at instanceof Date ? b.updated_at : new Date()).toISOString(),
    };
  }
}
