// Booking repository contract
import { BookingEntity } from '../entities/booking.entity';

export interface IBookingRepository {
  create(eventId: number, userId: number, ticketCount: number, client: unknown): Promise<BookingEntity>;
  sumTicketsByUserForEvent(eventId: number, userId: number, client: unknown): Promise<number>;
  findByUserId(userId: number, page: number, limit: number): Promise<{ bookings: BookingEntity[]; total: number }>;
  findAll(page: number, limit: number): Promise<{ bookings: BookingEntity[]; total: number }>;
  findById(id: number): Promise<BookingEntity | null>;
  lockForUpdate(id: number, client: unknown): Promise<BookingEntity | null>;
  updateStatus(id: number, status: 'cancelled', client: unknown): Promise<BookingEntity>;
}
