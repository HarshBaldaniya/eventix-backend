// Loads env and validates config before tests - required so rate-limit middleware can init at app load
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { loadAndValidateConfig } from './src/infrastructure/config/config.loader';

const root = resolve(process.cwd());
const envTest = resolve(root, '.env.test');
const envDefault = resolve(root, '.env');
const envDev = resolve(root, '.env.dev');
const envExample = resolve(root, '.env.example');

if (existsSync(envTest)) {
  config({ path: envTest });
} else if (existsSync(envDefault)) {
  config({ path: envDefault });
} else if (existsSync(envDev)) {
  config({ path: envDev });
} else if (existsSync(envExample)) {
  config({ path: envExample });
}

loadAndValidateConfig();
