// Unit tests: Rate limit middleware - response body and skip logic
import { describe, it, expect, vi } from 'vitest';
import {
  createRateLimitResponseBody,
  shouldSkipRateLimit,
} from '../../src/presentation/middlewares/rate-limit.middleware';
import { EVB429001 } from '../../src/shared/constants/error-code.constants';

describe('Rate limit middleware', () => {
  describe('createRateLimitResponseBody', () => {
    it('returns correct envelope with success false and error code EVB429001', () => {
      const body = createRateLimitResponseBody(60_000, 100);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(EVB429001);
      expect(body.error.message).toBe('Too many requests. Please try again later.');
    });

    it('includes window_seconds rounded from windowMs', () => {
      const body = createRateLimitResponseBody(60_000, 50);
      expect(body.error.details).toHaveProperty('window_seconds', 60);
    });

    it('includes max_requests in details', () => {
      const body = createRateLimitResponseBody(30_000, 10);
      expect(body.error.details).toHaveProperty('max_requests', 10);
    });

    it('rounds window_seconds for non-integer windows', () => {
      const body = createRateLimitResponseBody(90_000, 20);
      expect(body.error.details.window_seconds).toBe(90);
    });
  });

  describe('shouldSkipRateLimit', () => {
    const createMockReq = (path: string, originalUrl?: string) =>
      ({ path, originalUrl: originalUrl ?? path }) as never;

    it('returns true when nodeEnv is test', () => {
      expect(shouldSkipRateLimit(createMockReq('/api/v1/events'), 'test')).toBe(true);
      expect(shouldSkipRateLimit(createMockReq('/api/v1/auth/login'), 'test')).toBe(true);
    });

    it('returns false when nodeEnv is dev and path is not health', () => {
      expect(shouldSkipRateLimit(createMockReq('/api/v1/events'), 'dev')).toBe(false);
      expect(shouldSkipRateLimit(createMockReq('/api/v1/auth/register'), 'dev')).toBe(false);
    });

    it('returns true when path is /health', () => {
      expect(shouldSkipRateLimit(createMockReq('/health'), 'dev')).toBe(true);
    });

    it('returns true when path ends with /health', () => {
      expect(shouldSkipRateLimit(createMockReq('/api/v1/health'), 'dev')).toBe(true);
    });

    it('returns true when originalUrl ends with /health', () => {
      const req = createMockReq('', '/api/v1/health');
      expect(shouldSkipRateLimit(req, 'dev')).toBe(true);
    });

    it('strips trailing slash when checking path', () => {
      expect(shouldSkipRateLimit(createMockReq('/health/'), 'dev')).toBe(true);
    });

    it('returns false for prod and non-health paths', () => {
      expect(shouldSkipRateLimit(createMockReq('/api/v1/bookings'), 'prod')).toBe(false);
    });
  });
});
