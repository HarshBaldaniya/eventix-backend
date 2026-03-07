// Auth DTOs for request/response
export interface RegisterDto {
  email: string;
  password: string;
  name?: string;
  role?: 'user' | 'admin';
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponseDto {
  user: { id: number; email: string; name: string | null; role: 'user' | 'admin' };
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface RefreshDto {
  refresh_token: string;
}
