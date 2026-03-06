// DB-level security - uses validated config from infrastructure/config
import { getConfig } from '../../infrastructure/config/config.loader';

export const DB_SECURITY = { USE_PARAMETERIZED_QUERIES: true } as const;

export const dbSecurity = {
  getDbConfig: () => {
    const cfg = getConfig();
    return { host: cfg.DB_HOST, port: cfg.DB_PORT, database: cfg.DB_NAME, user: cfg.DB_USER, password: cfg.DB_PASSWORD, max: cfg.DB_POOL_MAX };
  },
};
