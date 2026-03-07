// Auth controller - register, login, logout, refresh
import { Request, Response } from 'express';
import { AuthService } from '../../application/services/auth.service';
import { STATUS_CODE_OK, STATUS_CODE_CREATED } from '../../shared/constants/status-code.constants';
import { asyncHandler } from '../middlewares/async-handler.middleware';
import { registerSchema, loginSchema, refreshSchema, logoutSchema } from '../../application/validators/auth.validator';
import { parseOrThrow } from '../../shared/utils/validation.util';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const body = parseOrThrow(registerSchema, req.body);
    const result = await this.authService.register(body);
    res.status(STATUS_CODE_CREATED).json({ success: true, data: result });
  });

  login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const body = parseOrThrow(loginSchema, req.body);
    const result = await this.authService.login(body);
    res.status(STATUS_CODE_OK).json({ success: true, data: result });
  });

  logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const body = parseOrThrow(logoutSchema, req.body);
    await this.authService.logout(body.refresh_token);
    res.status(STATUS_CODE_OK).json({ success: true, data: { message: 'Logged out' } });
  });

  refresh = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const body = parseOrThrow(refreshSchema, req.body);
    const result = await this.authService.refresh(body.refresh_token);
    res.status(STATUS_CODE_OK).json({ success: true, data: result });
  });
}
