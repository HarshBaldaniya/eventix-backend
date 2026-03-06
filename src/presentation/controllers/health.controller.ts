// Health controller - handles HTTP for health route
import { Request, Response } from 'express';
import { HealthService } from '../../application/services/health.service';
import { appLogger } from '../../shared/logger/app.logger';
import { LOG_LABEL } from '../../shared/constants/log-label.constants';
import { STATUS_CODE_OK } from '../../shared/constants/status-code.constants';

const logLabel = LOG_LABEL.PRESENTATION;

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  getHealth = async (_req: Request, res: Response): Promise<void> => {
    appLogger.info({ label: logLabel, msg: 'Health endpoint hit' });
    const health = await this.healthService.getHealth();
    res.status(STATUS_CODE_OK).json(health);
  };
}
