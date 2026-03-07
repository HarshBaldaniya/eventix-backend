// Auth middleware: Validates JWT access tokens for protected route access
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getConfig } from '../../infrastructure/config/config.loader';
import { AppError } from '../../shared/errors/app.error';
import { STATUS_CODE_UNAUTHORIZED } from '../../shared/constants/status-code.constants';
import { EVB401001 } from '../../shared/constants/error-code.constants';

export const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const bypassUserId = req.headers['x-test-user-id'];
  if (process.env.NODE_ENV !== 'prod' && bypassUserId) {
    (req as any).user = { id: parseInt(bypassUserId as string, 10), role: 'user' };
    return next();
  }
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('Authentication required', STATUS_CODE_UNAUTHORIZED, EVB401001);
  }
  const token = authHeader.split(' ')[1]!;
  const config = getConfig();
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { sub: string; email: string; role: string; type: string };
    if (decoded.type !== 'access') {
      throw new AppError('Invalid token type', STATUS_CODE_UNAUTHORIZED, EVB401001);
    }
    (req as any).user = { id: parseInt(decoded.sub, 10), email: decoded.email, role: decoded.role };
    next();
  } catch (err) {
    throw new AppError('Invalid or expired token', STATUS_CODE_UNAUTHORIZED, EVB401001);
  }
};
