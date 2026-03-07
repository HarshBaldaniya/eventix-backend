// User entity - excludes password_hash for safe exposure
export interface UserEntity {
  id: number;
  email: string;
  name: string | null;
  role: 'user' | 'admin';
  created_at: Date;
}
