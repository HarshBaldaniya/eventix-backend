// Unit tests: BookingService - bookSpot, listBookings, getBookingById, cancelBooking
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService } from '../../src/application/services/booking.service';
import { AppError } from '../../src/shared/errors/app.error';
import { EVB403001, EVB404001, EVB409001, EVB409004, EVB409005, EVB409006, EVB422001 } from '../../src/shared/constants/error-code.constants';

const mockClient = {};

function createMocks() {
  const executeInTransaction = vi.fn((fn: (c: unknown) => Promise<unknown>) => fn(mockClient));
  const transactionManager = { executeInTransaction };

  const eventRepo = {
    findByIdWithClient: vi.fn(),
    reserveSpots: vi.fn(),
    lockForUpdate: vi.fn(),
    decrementBookedCount: vi.fn(),
  };

  const bookingRepo = {
    create: vi.fn(),
    sumTicketsByUserForEvent: vi.fn(),
    findById: vi.fn(),
    lockForUpdate: vi.fn(),
    updateStatus: vi.fn(),
    findByUserId: vi.fn(),
    findAll: vi.fn(),
  };

  const bookingAuditRepo = { insert: vi.fn() };
  const bookingConfigRepo = { getForEvent: vi.fn() };

  return {
    transactionManager,
    eventRepo,
    bookingRepo,
    bookingAuditRepo,
    bookingConfigRepo,
  };
}

describe('BookingService', () => {
  let service: BookingService;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
    mocks.bookingConfigRepo.getForEvent.mockResolvedValue({ max_tickets_per_booking: 5, max_tickets_per_user: 10 });
    service = new BookingService(
      mocks.transactionManager as never,
      mocks.eventRepo as never,
      mocks.bookingRepo as never,
      mocks.bookingAuditRepo as never,
      mocks.bookingConfigRepo as never
    );
  });

  describe('bookSpot', () => {
    it('throws 404 when event not found', async () => {
      mocks.eventRepo.findByIdWithClient.mockResolvedValue(null);
      await expect(service.bookSpot(999, 1, 1)).rejects.toThrow(AppError);
      await expect(service.bookSpot(999, 1, 1)).rejects.toMatchObject({ errorCode: EVB404001 });
    });

    it('throws 409 when event is not published', async () => {
      mocks.eventRepo.findByIdWithClient.mockResolvedValue({
        id: 1,
        status: 'draft',
        remaining_spots: 10,
        capacity: 10,
        booked_count: 0,
      });
      await expect(service.bookSpot(1, 1, 1)).rejects.toThrow(AppError);
      await expect(service.bookSpot(1, 1, 1)).rejects.toMatchObject({ errorCode: EVB409006 });
    });

    it('throws 409 when event is sold out', async () => {
      mocks.eventRepo.findByIdWithClient.mockResolvedValue({
        id: 1,
        status: 'published',
        remaining_spots: 0,
        capacity: 10,
        booked_count: 10,
      });
      await expect(service.bookSpot(1, 1, 1)).rejects.toThrow(AppError);
      await expect(service.bookSpot(1, 1, 1)).rejects.toMatchObject({ errorCode: EVB409001 });
    });

    it('throws 409 when ticket_count exceeds max_tickets_per_booking', async () => {
      mocks.eventRepo.findByIdWithClient.mockResolvedValue({
        id: 1,
        status: 'published',
        remaining_spots: 10,
        capacity: 10,
        booked_count: 0,
      });
      mocks.bookingConfigRepo.getForEvent.mockResolvedValue({ max_tickets_per_booking: 2, max_tickets_per_user: 10 });
      await expect(service.bookSpot(1, 1, 5)).rejects.toThrow(AppError);
      await expect(service.bookSpot(1, 1, 5)).rejects.toMatchObject({ errorCode: EVB409004 });
    });

    it('throws 409 when user exceeds max_tickets_per_user', async () => {
      mocks.eventRepo.findByIdWithClient.mockResolvedValue({
        id: 1,
        status: 'published',
        remaining_spots: 10,
        capacity: 10,
        booked_count: 0,
      });
      mocks.bookingConfigRepo.getForEvent.mockResolvedValue({ max_tickets_per_booking: 5, max_tickets_per_user: 2 });
      mocks.bookingRepo.sumTicketsByUserForEvent.mockResolvedValue(2);
      await expect(service.bookSpot(1, 1, 1)).rejects.toThrow(AppError);
      await expect(service.bookSpot(1, 1, 1)).rejects.toMatchObject({ errorCode: EVB409005 });
    });

    it('returns booking when successful', async () => {
      mocks.eventRepo.findByIdWithClient.mockResolvedValue({
        id: 1,
        status: 'published',
        remaining_spots: 10,
        capacity: 10,
        booked_count: 0,
      });
      mocks.bookingRepo.sumTicketsByUserForEvent.mockResolvedValue(0);
      mocks.eventRepo.reserveSpots.mockResolvedValue({
        id: 1,
        status: 'published',
        remaining_spots: 8,
        capacity: 10,
        booked_count: 2,
      });
      mocks.bookingRepo.create.mockResolvedValue({
        id: 101,
        event_id: 1,
        user_id: 1,
        ticket_count: 2,
        status: 'confirmed',
        created_at: new Date(),
        updated_at: new Date(),
      });
      const result = await service.bookSpot(1, 1, 2);
      expect(result.id).toBe(101);
      expect(result.event_id).toBe(1);
      expect(result.user_id).toBe(1);
      expect(result.ticket_count).toBe(2);
      expect(result.status).toBe('confirmed');
    });
  });

  describe('listBookings', () => {
    it('returns user bookings when role is user', async () => {
      mocks.bookingRepo.findByUserId.mockResolvedValue({
        bookings: [
          {
            id: 1,
            event_id: 1,
            user_id: 1,
            ticket_count: 2,
            status: 'confirmed',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        total: 1,
      });
      const result = await service.listBookings(1, 'user', 1, 10);
      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0].id).toBe(1);
      expect(result.pagination.total).toBe(1);
    });

    it('returns all bookings when role is admin', async () => {
      mocks.bookingRepo.findAll.mockResolvedValue({
        bookings: [
          {
            id: 1,
            event_id: 1,
            user_id: 1,
            ticket_count: 2,
            status: 'confirmed',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        total: 1,
      });
      const result = await service.listBookings(1, 'admin', 1, 10);
      expect(result.bookings).toHaveLength(1);
      expect(mocks.bookingRepo.findAll).toHaveBeenCalledWith(1, 10);
    });
  });

  describe('getBookingById', () => {
    it('throws 404 when booking not found', async () => {
      mocks.bookingRepo.findById.mockResolvedValue(null);
      await expect(service.getBookingById(999, 1, 'user')).rejects.toThrow(AppError);
      await expect(service.getBookingById(999, 1, 'user')).rejects.toMatchObject({ errorCode: EVB404001 });
    });

    it('throws 403 when user tries to access another user booking', async () => {
      mocks.bookingRepo.findById.mockResolvedValue({
        id: 1,
        event_id: 1,
        user_id: 2,
        ticket_count: 2,
        status: 'confirmed',
        created_at: new Date(),
        updated_at: new Date(),
      });
      await expect(service.getBookingById(1, 1, 'user')).rejects.toThrow(AppError);
      await expect(service.getBookingById(1, 1, 'user')).rejects.toMatchObject({ errorCode: EVB403001 });
    });

    it('returns booking when user owns it', async () => {
      mocks.bookingRepo.findById.mockResolvedValue({
        id: 1,
        event_id: 1,
        user_id: 1,
        ticket_count: 2,
        status: 'confirmed',
        created_at: new Date(),
        updated_at: new Date(),
      });
      const result = await service.getBookingById(1, 1, 'user');
      expect(result.id).toBe(1);
      expect(result.user_id).toBe(1);
    });
  });

  describe('cancelBooking', () => {
    it('throws 404 when booking not found', async () => {
      mocks.bookingRepo.lockForUpdate.mockResolvedValue(null);
      await expect(service.cancelBooking(999, 1, 'user')).rejects.toThrow(AppError);
      await expect(service.cancelBooking(999, 1, 'user')).rejects.toMatchObject({ errorCode: EVB404001 });
    });

    it('throws 403 when user tries to cancel another user booking', async () => {
      mocks.bookingRepo.lockForUpdate.mockResolvedValue({
        id: 1,
        event_id: 1,
        user_id: 2,
        ticket_count: 2,
        status: 'confirmed',
        created_at: new Date(),
        updated_at: new Date(),
      });
      await expect(service.cancelBooking(1, 1, 'user')).rejects.toThrow(AppError);
      await expect(service.cancelBooking(1, 1, 'user')).rejects.toMatchObject({ errorCode: EVB403001 });
    });

    it('throws 422 when booking already cancelled', async () => {
      mocks.bookingRepo.lockForUpdate.mockResolvedValue({
        id: 1,
        event_id: 1,
        user_id: 1,
        ticket_count: 2,
        status: 'cancelled',
        created_at: new Date(),
        updated_at: new Date(),
      });
      await expect(service.cancelBooking(1, 1, 'user')).rejects.toThrow(AppError);
      await expect(service.cancelBooking(1, 1, 'user')).rejects.toMatchObject({ errorCode: EVB422001 });
    });

    it('returns cancelled booking when successful', async () => {
      mocks.bookingRepo.lockForUpdate.mockResolvedValue({
        id: 1,
        event_id: 1,
        user_id: 1,
        ticket_count: 2,
        status: 'confirmed',
        created_at: new Date(),
        updated_at: new Date(),
      });
      mocks.eventRepo.lockForUpdate.mockResolvedValue({ id: 1 });
      mocks.bookingRepo.updateStatus.mockResolvedValue({
        id: 1,
        event_id: 1,
        user_id: 1,
        ticket_count: 2,
        status: 'cancelled',
        created_at: new Date(),
        updated_at: new Date(),
      });
      const result = await service.cancelBooking(1, 1, 'user');
      expect(result.status).toBe('cancelled');
    });
  });
});
