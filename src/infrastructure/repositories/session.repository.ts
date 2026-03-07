// Session repository - implements ISessionRepository for login/logout
import { ISessionRepository } from '../../domain/interfaces/session.repository.interface';
import { getPostgresPool } from '../database/postgres.client';
import { SESSION_QUERIES } from '../database/queries/session.queries';
import { appLogger } from '../../shared/logger/app.logger';
import { LOG_LABEL } from '../../shared/constants/log-label.constants';

const logLabel = LOG_LABEL.INFRASTRUCTURE;

export class SessionRepository implements ISessionRepository {
  async create(userId: number, refreshTokenHash: string, expiresAt: Date): Promise<void> {
    try {
      const pool = await getPostgresPool();
      await pool.query(SESSION_QUERIES.INSERT, [userId, refreshTokenHash, expiresAt]);
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'SessionRepository.create failed', err });
      throw err;
    }
  }

  async findByTokenHash(tokenHash: string): Promise<{ user_id: number } | null> {
    try {
      const pool = await getPostgresPool();
      const result = await pool.query(SESSION_QUERIES.FIND_BY_TOKEN_HASH, [tokenHash]);
      const row = result.rows[0];
      if (!row) return null;
      return { user_id: row.user_id };
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'SessionRepository.findByTokenHash failed', err });
      throw err;
    }
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    try {
      const pool = await getPostgresPool();
      await pool.query(SESSION_QUERIES.DEACTIVATE_BY_TOKEN_HASH, [tokenHash]);
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'SessionRepository.deleteByTokenHash failed', err });
      throw err;
    }
  }
}
