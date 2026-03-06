// Health service - orchestrates health check use case
import { IHealthRepository } from '../../domain/interfaces/health.repository.interface';
import { appLogger } from '../../shared/logger/app.logger';
import { LOG_LABEL } from '../../shared/constants/log-label.constants';

const logLabel = LOG_LABEL.APPLICATION;

export class HealthService {
  constructor(private readonly healthRepo: IHealthRepository) {}

  async getHealth(): Promise<{ status: string; db: string }> {
    appLogger.info({ label: logLabel, msg: 'Health check requested' });
    const dbOk = await this.healthRepo.checkDbConnection();
    return {
      status: 'ok',
      db: dbOk ? 'connected' : 'disconnected',
    };
  }
}
