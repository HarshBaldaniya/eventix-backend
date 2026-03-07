// Event routes - list, get by ID (public), create/update (admin), book spot (auth)
import { Router } from 'express';
import { EventController } from '../controllers/event.controller';
import { EventService } from '../../application/services/event.service';
import { EventRepository } from '../../infrastructure/repositories/event.repository';
import { EventAuditRepository } from '../../infrastructure/repositories/event-audit.repository';
import { BookingController } from '../controllers/booking.controller';
import { BookingService } from '../../application/services/booking.service';
import { BookingRepository } from '../../infrastructure/repositories/booking.repository';
import { BookingAuditRepository } from '../../infrastructure/repositories/booking-audit.repository';
import { EventBookingConfigRepository } from '../../infrastructure/repositories/event-booking-config.repository';
import { TransactionManager } from '../../infrastructure/database/transaction.manager';
import { authMiddleware } from '../middlewares/auth.middleware';
import { optionalAuthMiddleware } from '../middlewares/optional-auth.middleware';
import { requireRole } from '../middlewares/require-role.middleware';
const router = Router();
const eventRepo = new EventRepository();
const eventAuditRepo = new EventAuditRepository();
const transactionManager = new TransactionManager();
const bookingConfigRepo = new EventBookingConfigRepository();
const eventService = new EventService(eventRepo, eventAuditRepo, transactionManager, bookingConfigRepo);
const eventController = new EventController(eventService);

const bookingRepo = new BookingRepository();
const bookingAuditRepo = new BookingAuditRepository();
const bookingService = new BookingService(transactionManager, eventRepo, bookingRepo, bookingAuditRepo, bookingConfigRepo);
const bookingController = new BookingController(bookingService);

router.get('/', optionalAuthMiddleware, eventController.listEvents);
router.get('/:id', optionalAuthMiddleware, eventController.getEventById);
router.post('/', authMiddleware, requireRole(['admin']), eventController.createEvent);
router.patch('/:id', authMiddleware, requireRole(['admin']), eventController.updateEvent);
router.post('/:id/bookings', authMiddleware, bookingController.bookSpotForEvent);

export const eventRoutes = router;
