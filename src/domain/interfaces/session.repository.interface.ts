// Session repository contract - for login/logout with refresh token
export interface ISessionRepository {
  create(userId: number, refreshTokenHash: string, expiresAt: Date): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<{ user_id: number } | null>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
}
