// Auth service: Handles registration, login, logout, and token refresh
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { IUserRepository } from '../../domain/interfaces/user.repository.interface';
import { ISessionRepository } from '../../domain/interfaces/session.repository.interface';
import { getConfig } from '../../infrastructure/config/config.loader';
import { AppError } from '../../shared/errors/app.error';
import { STATUS_CODE_CONFLICT, STATUS_CODE_UNAUTHORIZED } from '../../shared/constants/status-code.constants';
import { EVB401001, EVB409003 } from '../../shared/constants/error-code.constants';
import type { RegisterDto, LoginDto, AuthResponseDto } from '../dtos/auth.dto';

const SALT_ROUNDS = 10;

function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseRefreshExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const [, num, unit] = match;
  const n = parseInt(num!, 10);
  const multipliers: Record<string, number> = { s: 1000, m: 60 * 1000, h: 3600 * 1000, d: 24 * 3600 * 1000 };
  return n * (multipliers[unit!] ?? 86400000);
}

export class AuthService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly sessionRepo: ISessionRepository
  ) { }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new AppError('Email already registered', STATUS_CODE_CONFLICT, EVB409003, { email: dto.email });
    }
    const hash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const role = (dto.role === 'admin' ? 'admin' : 'user') as 'user' | 'admin';
    const user = await this.userRepo.create(dto.email, hash, dto.name, role);
    const response = await this.buildAuthResponse(user.id, user.email, user.name, user.role);
    const config = getConfig();
    const expiresAt = new Date(Date.now() + parseRefreshExpiry(config.JWT_REFRESH_EXPIRY));
    const tokenHash = hashRefreshToken(response.refresh_token);
    await this.sessionRepo.create(user.id, tokenHash, expiresAt);
    return response;
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) {
      throw new AppError('Invalid email or password', STATUS_CODE_UNAUTHORIZED, EVB401001);
    }
    const match = await bcrypt.compare(dto.password, user.password_hash);
    if (!match) {
      throw new AppError('Invalid email or password', STATUS_CODE_UNAUTHORIZED, EVB401001);
    }
    const response = await this.buildAuthResponse(user.id, user.email, user.name, user.role);
    const config = getConfig();
    const expiresAt = new Date(Date.now() + parseRefreshExpiry(config.JWT_REFRESH_EXPIRY));
    const tokenHash = hashRefreshToken(response.refresh_token);
    await this.sessionRepo.create(user.id, tokenHash, expiresAt);
    return response;
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    await this.sessionRepo.deleteByTokenHash(tokenHash);
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    const config = getConfig();
    const tokenHash = hashRefreshToken(refreshToken);
    const session = await this.sessionRepo.findByTokenHash(tokenHash);
    if (!session) {
      throw new AppError('Session expired or invalid', STATUS_CODE_UNAUTHORIZED, EVB401001);
    }
    try {
      const decoded = jwt.verify(refreshToken, config.JWT_SECRET) as { sub: string; type: string };
      if (decoded.type !== 'refresh') {
        throw new AppError('Invalid token', STATUS_CODE_UNAUTHORIZED, EVB401001);
      }
      const userId = parseInt(decoded.sub, 10);
      const user = await this.userRepo.findById(userId);
      if (!user) {
        throw new AppError('User not found', STATUS_CODE_UNAUTHORIZED, EVB401001);
      }
      await this.sessionRepo.deleteByTokenHash(tokenHash);
      const response = await this.buildAuthResponse(user.id, user.email, user.name, user.role);
      const expiresAt = new Date(Date.now() + parseRefreshExpiry(config.JWT_REFRESH_EXPIRY));
      const newTokenHash = hashRefreshToken(response.refresh_token);
      await this.sessionRepo.create(user.id, newTokenHash, expiresAt);
      return response;
    } catch {
      await this.sessionRepo.deleteByTokenHash(tokenHash);
      throw new AppError('Authentication required', STATUS_CODE_UNAUTHORIZED, EVB401001);
    }
  }

  private buildAuthResponse(userId: number, email: string, name: string | null, role?: string): AuthResponseDto {
    const config = getConfig();
    const accessToken = jwt.sign(
      { sub: String(userId), email, role: role ?? 'user', type: 'access' },
      config.JWT_SECRET,
      { expiresIn: config.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'] }
    );
    const refreshToken = jwt.sign(
      { sub: String(userId), email, role: role ?? 'user', type: 'refresh' },
      config.JWT_SECRET,
      { expiresIn: config.JWT_REFRESH_EXPIRY as jwt.SignOptions['expiresIn'] }
    );
    const decoded = jwt.decode(accessToken) as { exp?: number };
    const expiresIn = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 3600;
    return {
      user: { id: userId, email, name, role: (role as 'admin' | 'user') ?? 'user' },
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
    };
  }
}
