// Event repository contract
import { EventEntity } from '../entities/event.entity';

export interface CreateEventInput {
  name: string;
  description?: string | null;
  capacity: number;
  status?: 'draft' | 'coming_soon' | 'published' | 'cancelled' | 'completed';
}

export interface UpdateEventInput {
  name?: string;
  description?: string | null;
  capacity?: number;
  status?: 'draft' | 'coming_soon' | 'published' | 'cancelled' | 'completed';
}

export interface EventListOptions {
  page: number;
  limit: number;
  search?: string;
  statuses?: string[];
  sortBy: 'created_at' | 'name' | 'remaining_spots';
  order: 'asc' | 'desc';
}

export interface IEventRepository {
  findAll(options: EventListOptions): Promise<{ events: EventEntity[]; total: number }>;
  findById(id: number): Promise<EventEntity | null>;
  /** Fetches event by id using the given transaction client. */
  findByIdWithClient(id: number, client: unknown): Promise<EventEntity | null>;
  lockForUpdate(id: number, client: unknown): Promise<EventEntity | null>;
  /** Atomic reserve: increments booked_count only if status=published and capacity allows. Returns updated event or null. */
  reserveSpots(id: number, ticketCount: number, client: unknown): Promise<EventEntity | null>;
  incrementBookedCount(id: number, amount: number, client: unknown): Promise<void>;
  decrementBookedCount(id: number, amount: number, client: unknown): Promise<void>;
  create(input: CreateEventInput): Promise<EventEntity>;
  createWithClient(input: CreateEventInput, client: unknown): Promise<EventEntity>;
  update(id: number, input: UpdateEventInput): Promise<EventEntity | null>;
  updateWithClient(id: number, input: UpdateEventInput, client: unknown): Promise<EventEntity | null>;
}
