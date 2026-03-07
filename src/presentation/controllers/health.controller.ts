// Health controller: Exposes application and infrastructure connectivity status
import { Request, Response } from 'express';
import { HealthService } from '../../application/services/health.service';
import { STATUS_CODE_OK } from '../../shared/constants/status-code.constants';
import { asyncHandler } from '../middlewares/async-handler.middleware';

export class HealthController {
  constructor(private readonly healthService: HealthService) { }

  checkHealth = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const result = await this.healthService.checkHealth();
    res.status(STATUS_CODE_OK).json(result);
  });
}



