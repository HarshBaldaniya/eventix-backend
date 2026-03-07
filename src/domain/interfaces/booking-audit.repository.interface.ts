// Booking audit log repository - book, cancel operations on bookings
import type { AuditOperation, AuditOutcome } from '../../shared/constants/audit.constants';

export type BookingAuditOperation = 'book' | 'cancel';

export interface BookingAuditInsert {
  operation: BookingAuditOperation;
  event_id: number;
  booking_id?: number | null;
  user_id?: number | null;
  ticket_count?: number | null;
  outcome: AuditOutcome;
  details?: Record<string, unknown> | null;
  error_code?: string | null;
  error_message?: string | null;
}

export interface BookingAuditEntity {
  id: number;
  operation: AuditOperation;
  event_id: number;
  booking_id: number | null;
  user_id: number | null;
  ticket_count: number | null;
  outcome: AuditOutcome;
  details: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
  created_at: Date;
}

export interface BookingAuditListFilters {
  event_id?: number;
  booking_id?: number;
  outcome?: AuditOutcome;
  date_from?: Date;
  date_to?: Date;
  page: number;
  limit: number;
}

export interface IBookingAuditRepository {
  insert(data: BookingAuditInsert, client?: unknown): Promise<void>;
  findAll(filters: BookingAuditListFilters): Promise<{ logs: BookingAuditEntity[]; total: number }>;
}
