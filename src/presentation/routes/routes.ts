// API routes: /api/v1/* - health, etc.
import { Router } from 'express';
import { healthRoutes } from './health.routes';
import { apiSecurityMiddleware } from '../middlewares/api.security';

const router = Router();
router.use('/health', apiSecurityMiddleware, healthRoutes);

export const routes = router;
