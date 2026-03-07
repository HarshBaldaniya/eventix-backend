// Zod schema for env validation - validates before app starts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['dev', 'test', 'stg', 'prod']).default('dev'),
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3000'),
  DB_HOST: z.string().min(1, 'DB_HOST is required'),
  DB_PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('5432'),
  DB_NAME: z.string().min(1, 'DB_NAME is required'),
  DB_USER: z.string().min(1, 'DB_USER is required'),
  DB_PASSWORD: z.string(),
  DB_POOL_MAX: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('20'),
  DB_SSL: z.string().transform((s) => s === 'true').default('false'),
  CORS_ORIGINS: z.string().default('http://localhost:3001,http://localhost:3002,http://127.0.0.1:3001,http://127.0.0.1:3002'),
  API_RATE_LIMIT_WINDOW_MS: z.string().transform(Number).pipe(z.number().min(1000)).default('60000'),
  API_RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).pipe(z.number().min(1)).default('100'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_ACCESS_EXPIRY: z.string().default('1h'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  AUDIT_ASYNC_FOR_EVENTS: z.string().transform((s) => s === 'true').default('false'),
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;
