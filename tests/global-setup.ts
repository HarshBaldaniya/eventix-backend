// Global setup + teardown. Teardown runs after ALL tests - cleans test data from DB.
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { loadAndValidateConfig } from '../src/infrastructure/config/config.loader';
import { getPostgresPool, closePostgresPool } from '../src/infrastructure/database/postgres.client';
import { cleanAllTestData } from './helpers/db-setup';

function loadEnv(): void {
  const root = resolve(process.cwd());
  const envTest = resolve(root, '.env.test');
  const envDefault = resolve(root, '.env');
  const envDev = resolve(root, '.env.dev');
  const envExample = resolve(root, '.env.example');
  if (existsSync(envTest)) config({ path: envTest });
  else if (existsSync(envDefault)) config({ path: envDefault });
  else if (existsSync(envDev)) config({ path: envDev });
  else if (existsSync(envExample)) config({ path: envExample });
}

export default function globalSetup(): () => Promise<void> {
  return async function teardown(): Promise<void> {
    try {
      loadEnv();
      loadAndValidateConfig();
      const pool = await getPostgresPool();
      const result = await cleanAllTestData(pool);
      if (result.eventsDeleted > 0 || result.usersDeleted > 0) {
        console.log(`[teardown] Cleaned: ${result.eventsDeleted} events, ${result.usersDeleted} users`);
      }
      await closePostgresPool();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('does not exist') || msg.includes('Config validation failed')) {
        return; // DB not configured or unit-only run - skip cleanup
      }
      console.error('[teardown] Cleanup failed:', err);
    }
  };
}
