// Integration: Full auth flow - register → login → protected route → logout. Verifies DB + API together.
import { describe, it, expect, beforeAll } from 'vitest';
import { getTestAgent } from '../helpers/test-app';
import { getPool, schemaExists, createTestUser } from '../helpers/db-setup';
import { authHeader } from '../helpers/auth-helper';
import { expectSuccessWithData } from '../helpers/response-assertions';

const HOOK_TIMEOUT = 15_000;
const TEST_TIMEOUT = 15_000;
const unique = () => `auth-int-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

describe('Auth integration - register, login, protected route, logout', () => {
  beforeAll(async () => {
    getTestAgent();
    const pool = await getPool();
    if (!(await schemaExists(pool))) {
      throw new Error('DB schema not initialized. Run: npm run db:init');
    }
  }, HOOK_TIMEOUT);

  it('register creates user in DB and returns tokens', async () => {
    const email = `${unique()}@test.local`;
    const agent = getTestAgent();
    const res = await agent
      .post('/api/v1/auth/register')
      .send({ email, password: 'Pass123!', name: 'Integration User' });

    expectSuccessWithData(res, 201, ['user', 'access_token', 'refresh_token']);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.name).toBe('Integration User');

    const pool = await getPool();
    const row = await pool.query('SELECT id, email, name, role FROM users WHERE email = $1', [email]);
    expect(row.rows.length).toBe(1);
    expect(row.rows[0].email).toBe(email);
    expect(row.rows[0].role).toBe('user');
  }, TEST_TIMEOUT);

  it('login returns tokens and session exists in DB', async () => {
    const email = `${unique()}@test.local`;
    const pool = await getPool();
    await createTestUser(pool, email, 'Pass123!');

    const agent = getTestAgent();
    const loginRes = await agent.post('/api/v1/auth/login').send({ email, password: 'Pass123!' });
    expectSuccessWithData(loginRes, 200, ['access_token', 'refresh_token']);

    const userRow = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    const userId = userRow.rows[0].id;
    const sessionRow = await pool.query('SELECT id FROM sessions WHERE user_id = $1', [userId]);
    expect(sessionRow.rows.length).toBeGreaterThan(0);
  }, TEST_TIMEOUT);

  it('access token works for protected route (GET /bookings)', async () => {
    const email = `${unique()}@test.local`;
    const agent = getTestAgent();
    const regRes = await agent.post('/api/v1/auth/register').send({ email, password: 'Pass123!' });
    const token = regRes.body.data.access_token;

    const res = await agent.get('/api/v1/bookings').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  }, TEST_TIMEOUT);

  it('logout invalidates session', async () => {
    const email = `${unique()}@test.local`;
    const agent = getTestAgent();
    const regRes = await agent.post('/api/v1/auth/register').send({ email, password: 'Pass123!' });
    const refreshToken = regRes.body.data.refresh_token;

    const logoutRes = await agent.post('/api/v1/auth/logout').send({ refresh_token: refreshToken });
    expect(logoutRes.status).toBe(200);

    const refreshRes = await agent.post('/api/v1/auth/refresh').send({ refresh_token: refreshToken });
    expect(refreshRes.status).toBe(401);
  }, TEST_TIMEOUT);
});
