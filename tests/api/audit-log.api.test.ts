// API tests: Audit log endpoint - GET /api/v1/audit-log (admin only)
import { describe, it, expect, beforeAll } from 'vitest';
import { getTestAgent } from '../helpers/test-app';
import { getPool, schemaExists } from '../helpers/db-setup';
import { registerUser, createAdminAndLogin, authHeader } from '../helpers/auth-helper';
import { expectSuccess, expectError, expectPagination } from '../helpers/response-assertions';
import { EVB401001, EVB403001 } from '../../src/shared/constants/error-code.constants';

const TEST_TIMEOUT = 15_000;
const HOOK_TIMEOUT = 15_000;
const unique = () => `audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

describe('Audit Log API', () => {
  let agent: ReturnType<typeof getTestAgent>;
  let adminTokens: { access_token: string };
  let userTokens: { access_token: string };

  beforeAll(async () => {
    agent = getTestAgent();
    const pool = await getPool();
    if (!(await schemaExists(pool))) {
      throw new Error('DB schema not initialized. Run: npm run db:init');
    }

    adminTokens = await createAdminAndLogin(`${unique()}@test.local`, 'AdminPass123');
    const userData = await registerUser(`${unique()}@test.local`, 'UserPass123');
    userTokens = userData;
  }, HOOK_TIMEOUT);

  it('GET /api/v1/audit-log without auth returns 401', async () => {
    const res = await agent.get('/api/v1/audit-log');
    expectError(res, 401, EVB401001);
  }, TEST_TIMEOUT);

  it('GET /api/v1/audit-log with user token returns 403', async () => {
    const res = await agent
      .get('/api/v1/audit-log')
      .set(authHeader(userTokens.access_token));
    expectError(res, 403, EVB403001);
  }, TEST_TIMEOUT);

  it('GET /api/v1/audit-log with admin returns 200 with data and pagination', async () => {
    const res = await agent
      .get('/api/v1/audit-log')
      .set(authHeader(adminTokens.access_token));
    expectSuccess(res, 200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expectPagination(res);
  }, TEST_TIMEOUT);

  it('GET /api/v1/audit-log with filters returns 200', async () => {
    const res = await agent
      .get('/api/v1/audit-log?page=1&limit=5&resource_type=event')
      .set(authHeader(adminTokens.access_token));
    expectSuccess(res, 200);
    expectPagination(res);
    expect(res.body.pagination.limit).toBe(5);
  }, TEST_TIMEOUT);
});
