// User repository contract
import { UserEntity } from '../entities/user.entity';

export interface IUserRepository {
  create(email: string, passwordHash: string, name?: string, role?: 'user' | 'admin'): Promise<UserEntity>;
  findByEmail(email: string): Promise<(UserEntity & { password_hash: string }) | null>;
  findById(id: number): Promise<UserEntity | null>;
}
