// API routes: /api/v1/* - health, auth, events, bookings, audit-log
import { Router } from 'express';
import { healthRoutes } from './health.routes';
import { authRoutes } from './auth.routes';
import { eventRoutes } from './event.routes';
import { bookingRoutes } from './booking.routes';
import { auditLogRoutes } from './audit-log.routes';

const router = Router();
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/events', eventRoutes);
router.use('/bookings', bookingRoutes);
router.use('/audit-log', auditLogRoutes);

export const routes = router;
