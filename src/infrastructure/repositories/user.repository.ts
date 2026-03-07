// User repository - implements IUserRepository
import { PoolClient } from 'pg';
import { IUserRepository } from '../../domain/interfaces/user.repository.interface';
import { UserEntity } from '../../domain/entities/user.entity';
import { getPostgresPool } from '../database/postgres.client';
import { USER_QUERIES } from '../database/queries/user.queries';
import { appLogger } from '../../shared/logger/app.logger';
import { LOG_LABEL } from '../../shared/constants/log-label.constants';

const logLabel = LOG_LABEL.INFRASTRUCTURE;

export class UserRepository implements IUserRepository {
  async create(email: string, passwordHash: string, name?: string, role: 'user' | 'admin' = 'user'): Promise<UserEntity> {
    try {
      const pool = await getPostgresPool();
      const result = await pool.query(USER_QUERIES.INSERT, [email, passwordHash, name ?? null, role]);
      const row = result.rows[0];
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        role: ((row.role as string) || 'user') as 'user' | 'admin',
        created_at: row.created_at,
      };
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'UserRepository.create failed', err });
      throw err;
    }
  }

  async findByEmail(email: string): Promise<(UserEntity & { password_hash: string }) | null> {
    try {
      const pool = await getPostgresPool();
      const result = await pool.query(USER_QUERIES.SELECT_BY_EMAIL, [email]);
      const row = result.rows[0];
      if (!row) return null;
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        role: ((row.role as string) || 'user') as 'user' | 'admin',
        created_at: row.created_at,
        password_hash: row.password_hash,
      };
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'UserRepository.findByEmail failed', err });
      throw err;
    }
  }

  async findById(id: number): Promise<UserEntity | null> {
    try {
      const pool = await getPostgresPool();
      const result = await pool.query(USER_QUERIES.SELECT_BY_ID, [id]);
      const row = result.rows[0];
      if (!row) return null;
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        role: ((row.role as string) || 'user') as 'user' | 'admin',
        created_at: row.created_at,
      };
    } catch (err) {
      appLogger.error({ label: logLabel, msg: 'UserRepository.findById failed', err });
      throw err;
    }
  }
}
