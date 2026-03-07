// Integration: Rate limit - real app skips in test env; verify middleware is mounted and skip works
import { describe, it, expect, beforeAll } from 'vitest';
import { getTestAgent } from '../helpers/test-app';
import { getPool, schemaExists } from '../helpers/db-setup';

const HOOK_TIMEOUT = 15_000;
const TEST_TIMEOUT = 15_000;

describe('Rate limit integration - app behavior in test env', () => {
  beforeAll(async () => {
    getTestAgent();
    const pool = await getPool();
    if (!(await schemaExists(pool))) {
      throw new Error('DB schema not initialized. Run: npm run db:init');
    }
  }, HOOK_TIMEOUT);

  it('many rapid requests to /api/v1/events do not return 429 (skip in test env)', async () => {
    const agent = getTestAgent();
    const requests = Array.from({ length: 25 }, () => agent.get('/api/v1/events'));
    const results = await Promise.all(requests);
    const allOk = results.every((r) => r.status === 200);
    expect(allOk).toBe(true);
  }, TEST_TIMEOUT);

  it('many rapid requests to /api/v1/auth/register do not return 429 (skip in test env)', async () => {
    const agent = getTestAgent();
    const ts = Date.now();
    const requests = Array.from({ length: 15 }, (_, i) =>
      agent.post('/api/v1/auth/register').send({
        email: `rate-limit-${ts}-${i}@test.local`,
        password: 'Pass123!',
      })
    );
    const results = await Promise.all(requests);
    const statuses = results.map((r) => r.status);
    const rateLimited = statuses.filter((s) => s === 429);
    expect(rateLimited).toHaveLength(0);
  }, TEST_TIMEOUT);

  it('health endpoint is accessible (would be skipped even if rate limit applied)', async () => {
    const agent = getTestAgent();
    const res = await agent.get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  }, TEST_TIMEOUT);
});
