// JWT auth middleware - validates token and attaches user to request
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getConfig } from '../../infrastructure/config/config.loader';
import { AppError } from '../../shared/errors/app.error';
import { STATUS_CODE_UNAUTHORIZED } from '../../shared/constants/status-code.constants';
import { EVB401001 } from '../../shared/constants/error-code.constants';

export const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Authentication required', STATUS_CODE_UNAUTHORIZED, EVB401001));
    }
    const token = authHeader.slice(7);
    const config = getConfig();
    const decoded = jwt.verify(token, config.JWT_SECRET) as { sub: string; email?: string; role?: string; type: string };
    if (decoded.type !== 'access') {
      return next(new AppError('Authentication required', STATUS_CODE_UNAUTHORIZED, EVB401001));
    }
    req.user = { id: parseInt(decoded.sub, 10), email: decoded.email ?? '', role: decoded.role ?? 'user' };
    next();
  } catch {
    next(new AppError('Authentication required', STATUS_CODE_UNAUTHORIZED, EVB401001));
  }
};
