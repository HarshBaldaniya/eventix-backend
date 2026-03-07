// Booking controller: Handles book spot, list, get, and cancel requests
import { Request, Response } from 'express';
import { BookingService } from '../../application/services/booking.service';
import { STATUS_CODE_OK, STATUS_CODE_CREATED } from '../../shared/constants/status-code.constants';
import { STATUS_CODE_UNAUTHORIZED } from '../../shared/constants/status-code.constants';
import { asyncHandler } from '../middlewares/async-handler.middleware';
import {
  bookSpotForEventSchema,
  cancelSchema,
  listBookingsQuerySchema,
  bookingIdParamSchema,
} from '../../application/validators/booking.validator';
import { parseOrThrow } from '../../shared/utils/validation.util';
import { AppError } from '../../shared/errors/app.error';
import { EVB401001 } from '../../shared/constants/error-code.constants';

export class BookingController {
  constructor(private readonly bookingService: BookingService) { }

  // POST /events/:id/bookings - eventId from params, ticket_count from body
  bookSpotForEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id: eventId } = parseOrThrow(bookingIdParamSchema, req.params);
    const body = parseOrThrow(bookSpotForEventSchema, req.body ?? {});
    const uid = req.user?.id;
    if (uid == null) throw new AppError('Authentication required', STATUS_CODE_UNAUTHORIZED, EVB401001);
    const result = await this.bookingService.bookSpot(eventId, uid, body.ticket_count ?? 1);
    res.status(STATUS_CODE_CREATED).json({ success: true, data: result });
  });

  listMyBookings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (userId == null) throw new AppError('Authentication required', STATUS_CODE_UNAUTHORIZED, EVB401001);
    const query = parseOrThrow(listBookingsQuerySchema, req.query);
    const result = await this.bookingService.listBookings(userId, 'user', query.page ?? 1, query.limit ?? 10);
    res.status(STATUS_CODE_OK).json({ success: true, data: result.bookings, pagination: result.pagination });
  });

  getBookingById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = parseOrThrow(bookingIdParamSchema, req.params);
    const userId = req.user?.id;
    if (userId == null) throw new AppError('Authentication required', STATUS_CODE_UNAUTHORIZED, EVB401001);
    const result = await this.bookingService.getBookingById(id, userId, req.user?.role ?? 'user');
    res.status(STATUS_CODE_OK).json({ success: true, data: result });
  });

  cancelBooking = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = parseOrThrow(bookingIdParamSchema, req.params);
    parseOrThrow(cancelSchema, req.body ?? {});
    const userId = req.user?.id;
    if (userId == null) throw new AppError('Authentication required', STATUS_CODE_UNAUTHORIZED, EVB401001);
    const result = await this.bookingService.cancelBooking(id, userId, req.user?.role ?? 'user');
    res.status(STATUS_CODE_OK).json({ success: true, data: result });
  });
}
