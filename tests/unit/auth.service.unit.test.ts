// Unit tests: AuthService - register, login, logout, refresh
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { loadAndValidateConfig } from '../../src/infrastructure/config/config.loader';
import { AuthService } from '../../src/application/services/auth.service';
import { AppError } from '../../src/shared/errors/app.error';
import { EVB401001, EVB409003 } from '../../src/shared/constants/error-code.constants';

function createMocks() {
  const userRepo = {
    findByEmail: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
  };
  const sessionRepo = {
    create: vi.fn(),
    findByTokenHash: vi.fn(),
    deleteByTokenHash: vi.fn(),
  };
  return { userRepo, sessionRepo };
}

describe('AuthService', () => {
  let service: AuthService;
  let mocks: ReturnType<typeof createMocks>;

  beforeAll(() => {
    loadAndValidateConfig();
  });

  beforeEach(() => {
    mocks = createMocks();
    service = new AuthService(mocks.userRepo as never, mocks.sessionRepo as never);
  });

  describe('register', () => {
    it('throws 409 when email already registered', async () => {
      mocks.userRepo.findByEmail.mockResolvedValue({ id: 1, email: 'a@test.com' });
      await expect(service.register({ email: 'a@test.com', password: 'pass123' })).rejects.toThrow(AppError);
      await expect(service.register({ email: 'a@test.com', password: 'pass123' })).rejects.toMatchObject({ errorCode: EVB409003 });
    });

    it('returns user and tokens on success', async () => {
      mocks.userRepo.findByEmail.mockResolvedValue(null);
      mocks.userRepo.create.mockResolvedValue({
        id: 1,
        email: 'new@test.com',
        name: 'Test',
        role: 'user',
      });
      mocks.sessionRepo.create.mockResolvedValue(undefined);
      const result = await service.register({ email: 'new@test.com', password: 'pass123', name: 'Test' });
      expect(result.user.id).toBe(1);
      expect(result.user.email).toBe('new@test.com');
      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
    });
  });

  describe('login', () => {
    it('throws 401 when user not found', async () => {
      mocks.userRepo.findByEmail.mockResolvedValue(null);
      await expect(service.login({ email: 'x@test.com', password: 'pass' })).rejects.toThrow(AppError);
      await expect(service.login({ email: 'x@test.com', password: 'pass' })).rejects.toMatchObject({ errorCode: EVB401001 });
    });

    it('throws 401 when password wrong', async () => {
      mocks.userRepo.findByEmail.mockResolvedValue({
        id: 1,
        email: 'a@test.com',
        name: null,
        role: 'user',
        password_hash: '$2b$10$invalidhash',
      });
      await expect(service.login({ email: 'a@test.com', password: 'wrong' })).rejects.toThrow(AppError);
      await expect(service.login({ email: 'a@test.com', password: 'wrong' })).rejects.toMatchObject({ errorCode: EVB401001 });
    });

    it('returns tokens on success', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('pass123', 4);
      mocks.userRepo.findByEmail.mockResolvedValue({
        id: 1,
        email: 'a@test.com',
        name: 'User',
        role: 'user',
        password_hash: hash,
      });
      mocks.sessionRepo.create.mockResolvedValue(undefined);
      const result = await service.login({ email: 'a@test.com', password: 'pass123' });
      expect(result.user.id).toBe(1);
      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
    });
  });

  describe('logout', () => {
    it('calls sessionRepo.deleteByTokenHash', async () => {
      mocks.sessionRepo.deleteByTokenHash.mockResolvedValue(undefined);
      await service.logout('some-refresh-token');
      expect(mocks.sessionRepo.deleteByTokenHash).toHaveBeenCalled();
    });
  });
});
