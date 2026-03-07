// Health service: Checks connection status for PostgreSQL and Redis infrastructure
import { IHealthRepository } from '../../domain/interfaces/health.repository.interface';

export class HealthService {
  constructor(private readonly healthRepo: IHealthRepository) { }

  async checkHealth(): Promise<{ status: string; db: string; redis: string }> {
    const isDbAlive = await this.healthRepo.checkDb();
    const isRedisAlive = await this.healthRepo.checkRedis();
    const allOk = isDbAlive && isRedisAlive;
    return {
      status: allOk ? 'ok' : 'error',
      db: isDbAlive ? 'connected' : 'disconnected',
      redis: isRedisAlive ? 'connected' : 'disconnected',
    };
  }
}
