// API tests: Rate limit - 429 when exceeded, response format, standard headers
import { describe, it, expect } from 'vitest';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import supertest from 'supertest';
import { createRateLimitHandler } from '../../src/presentation/middlewares/rate-limit.middleware';
import { EVB429001 } from '../../src/shared/constants/error-code.constants';
import { expectError, expectErrorDetails } from '../helpers/response-assertions';

const TEST_TIMEOUT = 10_000;
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 3;

/** Mini app with rate limit enabled - used to test 429 behavior without skipping */
function createRateLimitedApp() {
  const app = express();
  app.use(
    rateLimit({
      windowMs: WINDOW_MS,
      max: MAX_REQUESTS,
      handler: createRateLimitHandler(WINDOW_MS, MAX_REQUESTS),
      standardHeaders: true,
      legacyHeaders: false,
      skip: () => false,
    })
  );
  app.get('/ping', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('Rate limit API', () => {
  it('returns 200 for requests within limit', async () => {
    const app = createRateLimitedApp();
    const agent = supertest(app);
    const res = await agent.get('/ping');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  }, TEST_TIMEOUT);

  it('returns 429 with EVB429001 when limit exceeded', async () => {
    const app = createRateLimitedApp();
    const agent = supertest(app);

    for (let i = 0; i < MAX_REQUESTS; i++) {
      const res = await agent.get('/ping');
      expect(res.status).toBe(200);
    }

    const res = await agent.get('/ping');
    expectError(res, 429, EVB429001);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(EVB429001);
    expect(res.body.error.message).toBe('Too many requests. Please try again later.');
  }, TEST_TIMEOUT);

  it('429 response includes window_seconds and max_requests in details', async () => {
    const app = createRateLimitedApp();
    const agent = supertest(app);

    for (let i = 0; i <= MAX_REQUESTS; i++) await agent.get('/ping');

    const res = await agent.get('/ping');
    expectErrorDetails(res, 429, EVB429001, ['window_seconds', 'max_requests']);
    expect(res.body.error.details.window_seconds).toBe(60);
    expect(res.body.error.details.max_requests).toBe(MAX_REQUESTS);
  }, TEST_TIMEOUT);

  it('includes RateLimit-* standard headers when limit not exceeded', async () => {
    const app = createRateLimitedApp();
    const agent = supertest(app);
    const res = await agent.get('/ping');
    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  }, TEST_TIMEOUT);
});
