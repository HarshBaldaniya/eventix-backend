// Health repository - implements IHealthRepository, uses queries from queries folder
import { IHealthRepository } from '../../domain/interfaces/health.repository.interface';
import { getPostgresPool } from '../database/postgres.client';
import { HEALTH_QUERIES } from '../database/queries/health.queries';
import { appLogger } from '../../shared/logger/app.logger';
import { LOG_LABEL } from '../../shared/constants/log-label.constants';

const logLabel = LOG_LABEL.INFRASTRUCTURE;

export class HealthRepository implements IHealthRepository {
  async checkDbConnection(): Promise<boolean> {
    try {
      const pool = await getPostgresPool();
      await pool.query(HEALTH_QUERIES.PING);
      return true;
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'DB connection check failed', err });
      return false;
    }
  }
}
