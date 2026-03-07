// Booking routes - list, get, cancel (auth required)
import { Router } from 'express';
import { BookingController } from '../controllers/booking.controller';
import { BookingService } from '../../application/services/booking.service';
import { BookingRepository } from '../../infrastructure/repositories/booking.repository';
import { EventRepository } from '../../infrastructure/repositories/event.repository';
import { BookingAuditRepository } from '../../infrastructure/repositories/booking-audit.repository';
import { EventBookingConfigRepository } from '../../infrastructure/repositories/event-booking-config.repository';
import { TransactionManager } from '../../infrastructure/database/transaction.manager';
import { authMiddleware } from '../middlewares/auth.middleware';
const router = Router();
const bookingRepo = new BookingRepository();
const eventRepo = new EventRepository();
const bookingAuditRepo = new BookingAuditRepository();
const bookingConfigRepo = new EventBookingConfigRepository();
const transactionManager = new TransactionManager();
const bookingService = new BookingService(transactionManager, eventRepo, bookingRepo, bookingAuditRepo, bookingConfigRepo);
const bookingController = new BookingController(bookingService);

router.get('/', authMiddleware, bookingController.listMyBookings);
router.get('/:id', authMiddleware, bookingController.getBookingById);
router.patch('/:id', authMiddleware, bookingController.cancelBooking);

export const bookingRoutes = router;
