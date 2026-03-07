// Auth helper - register, login, create admin for API tests
import { getTestAgent } from './test-app';
import { getPool, createAdminUser } from './db-setup';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: { id: number; email: string; name: string | null };
}

// Register a new user via API and return tokens
export async function registerUser(
  email: string,
  password: string,
  name?: string
): Promise<AuthTokens> {
  const agent = getTestAgent();
  const payload = name !== undefined ? { email, password, name } : { email, password };
  const res = await agent
    .post('/api/v1/auth/register')
    .send(payload)
    .expect(201);

  const data = res.body as { success: boolean; data: AuthTokens };
  if (!data.success || !data.data?.access_token) {
    throw new Error('Register failed: ' + JSON.stringify(data));
  }
  return data.data;
}

// Login via API and return tokens
export async function loginUser(email: string, password: string): Promise<AuthTokens> {
  const agent = getTestAgent();
  const res = await agent
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  const body = res.body as { success: boolean; data: AuthTokens };
  if (!body.success || !body.data?.access_token) {
    throw new Error('Login failed: ' + JSON.stringify(body));
  }
  return body.data;
}

// Create an admin user in DB and login via API to get tokens. Use when tests need admin role (events create/update, audit-log).
export async function createAdminAndLogin(
  email: string,
  password: string
): Promise<AuthTokens> {
  getTestAgent(); // Ensures config is loaded before getPool
  const pool = await getPool();
  await createAdminUser(pool, email, password);
  return loginUser(email, password);
}

// Returns Authorization header value for Bearer token
export function authHeader(accessToken: string): { Authorization: string } {
  return { Authorization: `Bearer ${accessToken}` };
}
