// Entry point - validates config first, then loads app (rate-limit middleware needs config)
import { loadAndValidateConfig } from './infrastructure/config/config.loader';
import { getPostgresPool, closePostgresPool } from './infrastructure/database/postgres.client';
import { appLogger } from './shared/logger/app.logger';
import { LOG_LABEL } from './shared/constants/log-label.constants';

const logLabel = LOG_LABEL.APPLICATION;

async function bootstrap(): Promise<void> {
  const config = loadAndValidateConfig();
  const { app } = await import('./app');
  let dbStatus = 'unknown';
  try {
    const pool = await getPostgresPool();
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }
  const server = app.listen(config.PORT, () => {
    appLogger.info({
      label: logLabel,
      msg: `Server started | env=${config.NODE_ENV} port=${config.PORT} db=${dbStatus}`,
    });
  });
  process.on('SIGTERM', async () => {
    appLogger.info({ label: logLabel, msg: 'SIGTERM received, shutting down' });
    server.close();
    await closePostgresPool();
    process.exit(0);
  });
}

bootstrap();
