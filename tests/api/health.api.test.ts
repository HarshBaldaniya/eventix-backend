// API tests: Health endpoint - GET /api/v1/health returns status and db state
import { describe, it, expect, beforeAll } from 'vitest';
import { getTestAgent } from '../helpers/test-app';
import { schemaExists, getPool } from '../helpers/db-setup';
import { expectSuccess, expectError } from '../helpers/response-assertions';
import { EVB404001 } from '../../src/shared/constants/error-code.constants';

describe('Health API', () => {
  beforeAll(async () => {
    getTestAgent(); // Load config
    const pool = await getPool();
    if (!(await schemaExists(pool))) {
      throw new Error('DB schema not initialized. Run: npm run db:init (use same DB as .env.test)');
    }
  });

  it('GET /api/v1/health returns 200 with status and db', async () => {
    const agent = getTestAgent();
    const res = await agent.get('/api/v1/health');
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('db');
    expect(res.body.status).toBe('ok');
    expect(['connected', 'disconnected']).toContain(res.body.db);
  });

  it('GET /api/v1/unknown returns 404 with EVB404001 envelope', async () => {
    const agent = getTestAgent();
    const res = await agent.get('/api/v1/unknown');
    expectError(res, 404, EVB404001);
    expect(res.body.error).toHaveProperty('message');
    expect(res.body.error.details).toHaveProperty('path');
  });
});
