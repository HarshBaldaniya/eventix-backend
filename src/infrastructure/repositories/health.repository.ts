// Health repository: Implements IHealthRepository, checks database and cache status
import { IHealthRepository } from '../../domain/interfaces/health.repository.interface';
import { getPostgresPool } from '../database/postgres.client';
import { getRedisClient } from '../database/redis.client';
import { HEALTH_QUERIES } from '../database/queries/health.queries';
import { appLogger } from '../../shared/logger/app.logger';
import { LOG_LABEL } from '../../shared/constants/log-label.constants';

const logLabel = LOG_LABEL.INFRASTRUCTURE;

export class HealthRepository implements IHealthRepository {
  async checkDb(): Promise<boolean> {
    try {
      const pool = await getPostgresPool();
      await pool.query(HEALTH_QUERIES.PING);
      return true;
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'DB health check failed', err });
      return false;
    }
  }

  async checkRedis(): Promise<boolean> {
    try {
      const redis = getRedisClient();
      await redis.ping();
      return true;
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'Redis health check failed', err });
      return false;
    }
  }
}
