// Event service: Handles listing, retrieval, creation, and updates for events
import { IEventRepository } from '../../domain/interfaces/event.repository.interface';
import { IEventAuditRepository } from '../../domain/interfaces/event-audit.repository.interface';
import { IEventBookingConfigRepository } from '../../domain/interfaces/event-booking-config.repository.interface';
import { ITransactionManager } from '../../domain/interfaces/transaction.interface';
import { AppError } from '../../shared/errors/app.error';
import { STATUS_CODE_NOT_FOUND } from '../../shared/constants/status-code.constants';
import { EVB404001 } from '../../shared/constants/error-code.constants';
import type { EventResponseDto, EventListDto, PaginationDto } from '../dtos/event.dto';
import type { CreateEventInput, UpdateEventInput, ListEventsQuery } from '../validators/event.validator';
const PUBLIC_EVENT_STATUSES = ['published', 'coming_soon'] as const;

export class EventService {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly eventAuditRepo: IEventAuditRepository,
    private readonly transactionManager: ITransactionManager,
    private readonly bookingConfigRepo: IEventBookingConfigRepository
  ) { }

  async listEvents(options: ListEventsQuery & { asAdmin?: boolean }): Promise<EventListDto> {
    const { page, limit, search, status, sort_by, order, asAdmin } = options;
    const statuses = asAdmin ? (status ? [status] : undefined) : [...PUBLIC_EVENT_STATUSES];
    const { events, total } = await this.eventRepo.findAll({
      page,
      limit,
      search,
      statuses,
      sortBy: sort_by,
      order,
    });
    const totalPages = Math.ceil(total / limit) || 1;
    const pagination: PaginationDto = {
      page,
      limit,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    };
    const eventDtos: EventResponseDto[] = events.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      capacity: e.capacity,
      booked_count: e.booked_count,
      remaining_spots: e.remaining_spots,
      status: e.status as EventResponseDto['status'],
      created_at: e.created_at.toISOString(),
    }));
    return { events: eventDtos, pagination };
  }

  async getEventById(id: number, asAdmin?: boolean): Promise<EventResponseDto> {
    const event = await this.eventRepo.findById(id);
    if (!event) {
      throw new AppError('Event not found', STATUS_CODE_NOT_FOUND, EVB404001, { event_id: id });
    }
    if (!asAdmin && !PUBLIC_EVENT_STATUSES.includes(event.status as (typeof PUBLIC_EVENT_STATUSES)[number])) {
      throw new AppError('Event not found', STATUS_CODE_NOT_FOUND, EVB404001, { event_id: id });
    }
    const config = await this.bookingConfigRepo.getForEvent(id);
    return this.toEventDto(event, config);
  }

  async createEvent(input: CreateEventInput, userId: number): Promise<EventResponseDto> {
    return this.transactionManager.executeInTransaction(async (client) => {
      const event = await this.eventRepo.createWithClient(
        { name: input.name, description: input.description ?? null, capacity: input.capacity, status: input.status ?? 'draft' },
        client
      );
      await this.eventAuditRepo.insert(
        {
          operation: 'create',
          event_id: event.id,
          user_id: userId,
          outcome: 'success',
          details: { name: event.name, capacity: event.capacity, status: event.status },
        },
        client
      );
      return this.toEventDto(event);
    });
  }

  async updateEvent(id: number, input: UpdateEventInput, userId: number): Promise<EventResponseDto> {
    return this.transactionManager.executeInTransaction(async (client) => {
      const event = await this.eventRepo.updateWithClient(id, { name: input.name, description: input.description, capacity: input.capacity, status: input.status }, client);
      if (!event) {
        throw new AppError('Event not found', STATUS_CODE_NOT_FOUND, EVB404001, { event_id: id });
      }
      const changes: Record<string, unknown> = {};
      if (input.name !== undefined) changes.name = input.name;
      if (input.capacity !== undefined) changes.capacity = input.capacity;
      if (input.status !== undefined) changes.status = input.status;
      await this.eventAuditRepo.insert(
        {
          operation: 'update',
          event_id: event.id,
          user_id: userId,
          outcome: 'success',
          details: Object.keys(changes).length > 0 ? { changes } : undefined,
        },
        client
      );
      return this.toEventDto(event);
    });
  }

  private toEventDto(e: { id: number; name: string; description: string | null; capacity: number; booked_count: number; remaining_spots: number; status: string; created_at: Date }, config?: { max_tickets_per_booking: number }): EventResponseDto {
    return {
      id: e.id,
      name: e.name,
      description: e.description,
      capacity: e.capacity,
      booked_count: e.booked_count,
      remaining_spots: e.remaining_spots,
      status: e.status as EventResponseDto['status'],
      created_at: e.created_at.toISOString(),
      ...(config && { max_tickets_per_booking: config.max_tickets_per_booking }),
    };
  }
}
