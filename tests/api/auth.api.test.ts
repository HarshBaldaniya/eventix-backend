// API tests: Auth endpoints - register, login, logout, refresh
import { describe, it, expect, beforeAll } from 'vitest';
import { getTestAgent } from '../helpers/test-app';
import {
  registerUser,
  loginUser,
  createAdminAndLogin,
  authHeader,
} from '../helpers/auth-helper';
import { schemaExists, getPool, createTestUser } from '../helpers/db-setup';
import { expectSuccess, expectSuccessWithData, expectError } from '../helpers/response-assertions';
import { EVB400001, EVB401001, EVB409003 } from '../../src/shared/constants/error-code.constants';

const unique = () => `api-auth-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const TEST_PASSWORD = 'password123';

describe('Auth API', () => {
  beforeAll(async () => {
    getTestAgent();
    const pool = await getPool();
    if (!(await schemaExists(pool))) {
      throw new Error('DB schema not initialized. Run: npm run db:init');
    }
  });

  describe('POST /auth/register', () => {
    it('returns 201 with user and tokens on success', async () => {
      const email = `${unique()}@test.local`;
      const res = await getTestAgent()
        .post('/api/v1/auth/register')
        .send({ email, password: TEST_PASSWORD, name: 'Test User' });

      expectSuccessWithData(res, 201, ['user', 'access_token', 'refresh_token']);
      expect(res.body.data.user).toHaveProperty('id');
      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.user.name).toBe('Test User');
    });

    it('returns 400 for invalid email format', async () => {
      const res = await getTestAgent()
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: TEST_PASSWORD });

      expectError(res, 400, EVB400001);
    });

    it('returns 400 for short password', async () => {
      const res = await getTestAgent()
        .post('/api/v1/auth/register')
        .send({ email: `${unique()}@test.local`, password: 'short' });

      expectError(res, 400, EVB400001);
    });

    it('returns 409 when email already registered', async () => {
      const email = `${unique()}@test.local`;
      await registerUser(email, TEST_PASSWORD);

      const res = await getTestAgent()
        .post('/api/v1/auth/register')
        .send({ email, password: TEST_PASSWORD });

      expectError(res, 409, EVB409003);
    });
  });

  describe('POST /auth/login', () => {
    it('returns 200 with tokens on success', async () => {
      const email = `${unique()}@test.local`;
      const p = await getPool();
      await createTestUser(p, email, TEST_PASSWORD);

      const res = await getTestAgent()
        .post('/api/v1/auth/login')
        .send({ email, password: TEST_PASSWORD });

      expectSuccessWithData(res, 200, ['user', 'access_token', 'refresh_token']);
    });

    it('returns 400 for missing password', async () => {
      const res = await getTestAgent()
        .post('/api/v1/auth/login')
        .send({ email: `${unique()}@test.local` });

      expectError(res, 400, EVB400001);
    });

    it('returns 401 for wrong credentials', async () => {
      const email = `${unique()}@test.local`;
      await registerUser(email, TEST_PASSWORD);

      const res = await getTestAgent()
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrongpassword' });

      expectError(res, 401, EVB401001);
    });
  });

  describe('POST /auth/logout', () => {
    it('returns 200 on success', async () => {
      const { refresh_token } = await registerUser(`${unique()}@test.local`, TEST_PASSWORD);

      const res = await getTestAgent()
        .post('/api/v1/auth/logout')
        .send({ refresh_token });

      expectSuccess(res, 200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('message');
    });

    it('returns 400 for missing refresh_token', async () => {
      const res = await getTestAgent()
        .post('/api/v1/auth/logout')
        .send({});

      expectError(res, 400, EVB400001);
    });
  });

  describe('POST /auth/refresh', () => {
    it('returns 200 with new tokens on success', async () => {
      const { refresh_token } = await registerUser(`${unique()}@test.local`, TEST_PASSWORD);

      const res = await getTestAgent()
        .post('/api/v1/auth/refresh')
        .send({ refresh_token });

      expectSuccessWithData(res, 200, ['user', 'access_token', 'refresh_token']);
    });

    it('returns 400 for missing refresh_token', async () => {
      const res = await getTestAgent()
        .post('/api/v1/auth/refresh')
        .send({});

      expectError(res, 400, EVB400001);
    });

    it('returns 401 for invalid refresh token', async () => {
      const res = await getTestAgent()
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: 'invalid-token' });

      expectError(res, 401, EVB401001);
    });
  });

  describe('createAdminAndLogin helper', () => {
    it('returns admin tokens for protected routes', async () => {
      const tokens = await createAdminAndLogin(`${unique()}@test.local`, TEST_PASSWORD);
      expect(tokens.access_token).toBeDefined();
      expect(tokens.refresh_token).toBeDefined();
      expect(tokens.user).toBeDefined();
    });
  });
});
