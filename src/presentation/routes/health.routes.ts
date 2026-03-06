// GET /api/v1/health - returns service and DB status
import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';
import { HealthService } from '../../application/services/health.service';
import { HealthRepository } from '../../infrastructure/repositories/health.repository';
import { routeSecurityMiddleware } from '../middlewares/route.security';
import { asyncHandler } from '../middlewares/async-handler.middleware';

const router = Router();
const healthRepo = new HealthRepository();
const healthService = new HealthService(healthRepo);
const healthController = new HealthController(healthService);

router.get('/', routeSecurityMiddleware, asyncHandler(healthController.getHealth));

export const healthRoutes = router;
