// Booking service - book spot (transaction + lock), list, get, cancel with audit
import { IEventRepository } from '../../domain/interfaces/event.repository.interface';
import { IBookingRepository } from '../../domain/interfaces/booking.repository.interface';
import { IBookingAuditRepository } from '../../domain/interfaces/booking-audit.repository.interface';
import { IEventBookingConfigRepository } from '../../domain/interfaces/event-booking-config.repository.interface';
import { ITransactionManager } from '../../domain/interfaces/transaction.interface';
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

function isDeadlockError(err: unknown): boolean {
  return err instanceof Error && 'code' in err && (err as { code?: string }).code === POSTGRES_DEADLOCK_CODE;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class BookingService {
  constructor(
    private readonly transactionManager: ITransactionManager,
    private readonly eventRepo: IEventRepository,
    private readonly bookingRepo: IBookingRepository,
    private readonly bookingAuditRepo: IBookingAuditRepository,
    private readonly bookingConfigRepo: IEventBookingConfigRepository
  ) {}

  async bookSpot(eventId: number, userId: number, ticketCount: number): Promise<BookingResponseDto> {
    return this.withDeadlockRetry(() =>
      this.transactionManager.executeInTransaction(async (client) => {
          const event = await this.eventRepo.findByIdWithClient(eventId, client);
          if (!event) {
            throw new AppError('Event not found', STATUS_CODE_NOT_FOUND, EVB404001, { event_id: eventId });
          }
          if (event.status !== 'published') {
            const msg = 'Booking is not open for this event. Event is not published.';
            await this.bookingAuditRepo.insert(
              {
                operation: 'book',
                event_id: eventId,
                booking_id: null,
                user_id: userId,
                ticket_count: ticketCount,
                outcome: 'failure',
                details: { reason: 'not_published', status: event.status },
                error_code: EVB409006,
                error_message: msg,
              }
            );
            throw new AppError(msg, STATUS_CODE_CONFLICT, EVB409006, { event_id: eventId });
          }
          const remaining = event.remaining_spots;
          if (remaining < ticketCount) {
            const msg = remaining === 0
              ? 'Event is sold out. No spots remaining.'
              : `Only ${remaining} spot(s) remaining. You requested ${ticketCount}.`;
            await this.bookingAuditRepo.insert(
              {
                operation: 'book',
                event_id: eventId,
                booking_id: null,
                user_id: userId,
                ticket_count: ticketCount,
                outcome: 'failure',
                details: { reason: 'sold_out', requested: ticketCount, remaining },
                error_code: EVB409001,
                error_message: msg,
              }
            );
            throw new AppError(msg, STATUS_CODE_CONFLICT, EVB409001, {
              event_id: eventId,
              requested: ticketCount,
              remaining,
            });
          }
          const config = await this.bookingConfigRepo.getForEvent(eventId);
          if (ticketCount > config.max_tickets_per_booking) {
            const msg = `Maximum ${config.max_tickets_per_booking} tickets per request. You requested ${ticketCount}.`;
            await this.bookingAuditRepo.insert(
              {
                operation: 'book',
                event_id: eventId,
                booking_id: null,
                user_id: userId,
                ticket_count: ticketCount,
                outcome: 'failure',
                details: { reason: 'max_per_request_exceeded', max_per_request: config.max_tickets_per_booking, requested: ticketCount },
                error_code: EVB409004,
                error_message: msg,
              }
            );
            throw new AppError(msg, STATUS_CODE_CONFLICT, EVB409004, {
              event_id: eventId,
              max_tickets_per_booking: config.max_tickets_per_booking,
              requested: ticketCount,
            });
          }
          const userTickets = await this.bookingRepo.sumTicketsByUserForEvent(eventId, userId, client);
          if (userTickets + ticketCount > config.max_tickets_per_user) {
            const msg = `Maximum ${config.max_tickets_per_user} tickets total per user for this event. You have ${userTickets}, requested ${ticketCount} more.`;
            await this.bookingAuditRepo.insert(
              {
                operation: 'book',
                event_id: eventId,
                booking_id: null,
                user_id: userId,
                ticket_count: ticketCount,
                outcome: 'failure',
                details: { reason: 'max_per_user_exceeded', max_per_user: config.max_tickets_per_user, current: userTickets, requested: ticketCount },
                error_code: EVB409005,
                error_message: msg,
              }
            );
            throw new AppError(msg, STATUS_CODE_CONFLICT, EVB409005, {
              event_id: eventId,
              max_tickets_per_user: config.max_tickets_per_user,
              current: userTickets,
              requested: ticketCount,
            });
          }
          const reserved = await this.eventRepo.reserveSpots(eventId, ticketCount, client);
          if (!reserved) {
            const msg = 'Unable to complete booking. Spots may have been taken by another user. Please try again.';
            await this.bookingAuditRepo.insert(
              {
                operation: 'book',
                event_id: eventId,
                booking_id: null,
                user_id: userId,
                ticket_count: ticketCount,
                outcome: 'failure',
                details: { reason: 'race_or_capacity', requested: ticketCount },
                error_code: EVB409001,
                error_message: msg,
              }
            );
            throw new AppError(msg, STATUS_CODE_CONFLICT, EVB409001, {
              event_id: eventId,
              requested: ticketCount,
            });
          }
          const booking = await this.bookingRepo.create(eventId, userId, ticketCount, client);
          await this.bookingAuditRepo.insert(
            {
              operation: 'book',
              event_id: eventId,
              booking_id: booking.id,
              user_id: userId,
              ticket_count: ticketCount,
              outcome: 'success',
              details: { ticket_count: ticketCount, booking_id: booking.id },
            },
            client
          );
          return this.toDto(booking);
        })
    );
  }

  async listBookings(userId: number, role: string, page: number, limit: number): Promise<BookingListDto> {
    const { bookings, total } =
      role === 'admin'
        ? await this.bookingRepo.findAll(page, limit)
        : await this.bookingRepo.findByUserId(userId, page, limit);
    const totalPages = Math.ceil(total / limit) || 1;
    const pagination: PaginationDto = {
      page,
      limit,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    };
    return { bookings: bookings.map(this.toDto), pagination };
  }

  async getBookingById(id: number, userId: number, role: string): Promise<BookingResponseDto> {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) {
      throw new AppError('Booking not found', STATUS_CODE_NOT_FOUND, EVB404001, { booking_id: id });
    }
    if (role !== 'admin' && booking.user_id !== userId) {
      throw new AppError('You do not have permission to perform this action', STATUS_CODE_FORBIDDEN, EVB403001);
    }
    return this.toDto(booking);
  }

  async cancelBooking(bookingId: number, userId: number, role: string): Promise<BookingResponseDto> {
    return this.withDeadlockRetry(() =>
      this.transactionManager.executeInTransaction(async (client) => {
      const booking = await this.bookingRepo.lockForUpdate(bookingId, client);
      if (!booking) {
        throw new AppError('Booking not found', STATUS_CODE_NOT_FOUND, EVB404001, { booking_id: bookingId });
      }
      if (role !== 'admin' && booking.user_id !== userId) {
        throw new AppError('You do not have permission to perform this action', STATUS_CODE_FORBIDDEN, EVB403001);
      }
      if (booking.status === 'cancelled') {
        throw new AppError('Booking is already cancelled', STATUS_CODE_UNPROCESSABLE_ENTITY, EVB422001, {
          booking_id: bookingId,
        });
      }
      const event = await this.eventRepo.lockForUpdate(booking.event_id, client);
      if (!event) {
        throw new AppError('Event not found', STATUS_CODE_NOT_FOUND, EVB404001, { event_id: booking.event_id });
      }
      const updated = await this.bookingRepo.updateStatus(bookingId, 'cancelled', client);
      await this.eventRepo.decrementBookedCount(booking.event_id, booking.ticket_count, client);
      await this.bookingAuditRepo.insert(
        {
          operation: 'cancel',
          event_id: booking.event_id,
          booking_id: bookingId,
          user_id: role === 'admin' ? booking.user_id : userId,
          ticket_count: booking.ticket_count,
          outcome: 'success',
          details: { ticket_count: booking.ticket_count },
        },
        client
      );
      return this.toDto(updated);
      })
    );
  }

  private async withDeadlockRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < DEADLOCK_RETRY_ATTEMPTS; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (!isDeadlockError(err) || attempt === DEADLOCK_RETRY_ATTEMPTS - 1) {
          throw err;
        }
        await sleep(DEADLOCK_RETRY_DELAY_MS + Math.random() * 50);
      }
    }
    throw lastError;
  }

  private toDto(b: { id: number; event_id: number; user_id: number; ticket_count: number; status: string; created_at: Date; updated_at: Date }): BookingResponseDto {
    return {
      id: b.id,
      event_id: b.event_id,
      user_id: b.user_id,
      ticket_count: b.ticket_count,
      status: b.status as 'confirmed' | 'cancelled',
      created_at: b.created_at.toISOString(),
      updated_at: b.updated_at.toISOString(),
    };
  }
}
