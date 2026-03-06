// Loads and validates env - must run before app starts, fails fast on invalid config
import { config as loadEnv } from 'dotenv';
import { envSchema, type EnvConfig } from './env.schema';

let validatedConfig: EnvConfig | null = null;

function loadEnvFiles(): void {
  const nodeEnv = process.env.NODE_ENV || 'dev';
  loadEnv();
  loadEnv({ path: `.env.${nodeEnv}`, override: true }); // .env.dev | .env.test | .env.stg | .env.prod
}

export function loadAndValidateConfig(): EnvConfig {
  if (validatedConfig) return validatedConfig;
  loadEnvFiles();
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const msg = Object.entries(errors)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ');
    throw new Error(`Config validation failed: ${msg}`);
  }
  validatedConfig = result.data;
  return validatedConfig;
}

export function getConfig(): EnvConfig {
  if (!validatedConfig) throw new Error('Config not loaded. Call loadAndValidateConfig() first.');
  return validatedConfig;
}
