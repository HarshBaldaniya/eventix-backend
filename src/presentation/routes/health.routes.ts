// Health check routes
import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';
import { HealthService } from '../../application/services/health.service';
import { HealthRepository } from '../../infrastructure/repositories/health.repository';
import { asyncHandler } from '../middlewares/async-handler.middleware';

const router = Router();
const healthRepo = new HealthRepository();
const healthService = new HealthService(healthRepo);
const healthController = new HealthController(healthService);

router.get('/', healthController.checkHealth);

export const healthRoutes = router;
