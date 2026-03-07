// PostgreSQL client with pool and transaction support
import { Pool, PoolClient } from 'pg';
import { appLogger } from '../../shared/logger/app.logger';
import { LOG_LABEL } from '../../shared/constants/log-label.constants';
import { dbSecurity } from '../../shared/security/db.security';

const logLabel = LOG_LABEL.INFRASTRUCTURE;
let pool: Pool | null = null;

export async function getPostgresPool(): Promise<Pool> {
  if (!pool) {
    const config = dbSecurity.getDbConfig();
    pool = new Pool(config);
    appLogger.info({ label: logLabel, msg: 'PostgreSQL pool initialized' });
  }
  return pool;
}

export async function getPostgresClient(): Promise<PoolClient> {
  const p = await getPostgresPool();
  return p.connect();
}

// Execute callback within a transaction - auto commit on success, rollback on error
export async function executeInTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPostgresClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    if (process.env.NODE_ENV !== 'test') {
      appLogger.error({ label: logLabel, msg: 'Transaction rolled back', err });
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function closePostgresPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    appLogger.info({ label: logLabel, msg: 'PostgreSQL pool closed' });
  }
}
