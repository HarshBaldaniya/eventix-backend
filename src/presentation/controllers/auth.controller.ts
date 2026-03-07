// Auth controller: Orchestrates user registration, login, logout, and token refresh
import { Request, Response } from 'express';
import { AuthService } from '../../application/services/auth.service';
import { registerSchema, loginSchema, refreshSchema, logoutSchema } from '../../application/validators/auth.validator';
import { validateRequest } from '../../shared/utils/validation.util';
import { STATUS_CODE_CREATED, STATUS_CODE_OK } from '../../shared/constants/status-code.constants';
import { asyncHandler } from '../middlewares/async-handler.middleware';

export class AuthController {
  constructor(private readonly authService: AuthService) { }

  register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data = validateRequest(registerSchema, req.body);
    const result = await this.authService.register(data);
    res.status(STATUS_CODE_CREATED).json({ success: true, data: result });
  });

  login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data = validateRequest(loginSchema, req.body);
    const result = await this.authService.login(data);
    const isProd = process.env.NODE_ENV === 'prod';
    res.cookie('refreshToken', result.refresh_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(STATUS_CODE_OK).json({ success: true, data: result });
  });

  logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data = validateRequest(logoutSchema, { refresh_token: req.cookies?.refreshToken || req.body.refresh_token });
    await this.authService.logout(data.refresh_token);
    res.clearCookie('refreshToken');
    res.status(STATUS_CODE_OK).json({ success: true, data: { message: 'Logged out' } });
  });

  refresh = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data = validateRequest(refreshSchema, { refresh_token: req.cookies?.refreshToken || req.body.refresh_token });
    const result = await this.authService.refresh(data.refresh_token);
    const isProd = process.env.NODE_ENV === 'prod';
    res.cookie('refreshToken', result.refresh_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(STATUS_CODE_OK).json({ success: true, data: result });
  });
}

