// Rate limit middleware: Uses API_RATE_LIMIT_WINDOW_MS and API_RATE_LIMIT_MAX_REQUESTS from env
// Applies to all /api/v1/* routes except /health (for load balancer probes)
import { rateLimit } from 'express-rate-limit';
import type { Request, Response } from 'express';
import { getConfig } from '../../infrastructure/config/config.loader';
import { EVB429001 } from '../../shared/constants/error-code.constants';
import { STATUS_CODE_TOO_MANY_REQUESTS } from '../../shared/constants/status-code.constants';

// Builds the 429 response body - exported for unit tests
export function createRateLimitResponseBody(windowMs: number, max: number) {
  return {
    success: false,
    error: {
      code: EVB429001,
      message: 'Too many requests. Please try again later.',
      details: {
        window_seconds: Math.round(windowMs / 1000),
        max_requests: max,
      },
    },
  };
}

// Skip logic - exported for unit tests
export function shouldSkipRateLimit(req: Request, nodeEnv: string): boolean {
  const testHeader = req.headers?.['x-test-rate-limit'];
  if (nodeEnv === 'test' && !testHeader) return true;
  if (testHeader) return false;
  const path = (req.path || req.originalUrl || '').replace(/\/$/, '');
  return path === '/health' || path.endsWith('/health');
}

// Creates rate limit handler that sends our standard 429 envelope
export function createRateLimitHandler(windowMs: number, max: number) {
  return (_req: Request, res: Response) => {
    res.status(STATUS_CODE_TOO_MANY_REQUESTS).json(createRateLimitResponseBody(windowMs, max));
  };
}

function createRateLimiter() {
  const config = getConfig();
  const windowMs = config.API_RATE_LIMIT_WINDOW_MS;
  const max = config.API_RATE_LIMIT_MAX_REQUESTS;

  return rateLimit({
    windowMs,
    max,
    handler: createRateLimitHandler(windowMs, max),
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => shouldSkipRateLimit(req, config.NODE_ENV),
  });
}

export const rateLimitMiddleware = createRateLimiter();
