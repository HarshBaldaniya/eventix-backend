// Common constants shared across the application. Prefix: COMMON_

export const COMMON_APP_NAME = 'backend-api';
export const COMMON_API_VERSION = 'v1';
export const COMMON_API_PREFIX = '/api/v1';
export const COMMON_DEFAULT_PORT = 3000;

export const commonConstants = {
  PORT: parseInt(process.env.PORT ?? String(COMMON_DEFAULT_PORT), 10),
  APP_NAME: COMMON_APP_NAME,
  API_VERSION: COMMON_API_VERSION,
  API_PREFIX: COMMON_API_PREFIX,
} as const;
