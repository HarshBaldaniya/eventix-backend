// API-level constants. Prefix: API_

import { COMMON_API_PREFIX } from './common.constants';

export const API_DEFAULT_PORT = 3000;
export const API_HEALTH_PATH = '/health';
export const API_REQUEST_TIMEOUT_MS = 30000;
export const API_KEY_HEADER = 'x-api-key';

export const apiConstants = {
  API_PREFIX: COMMON_API_PREFIX,
  API_KEY_HEADER,
} as const;
