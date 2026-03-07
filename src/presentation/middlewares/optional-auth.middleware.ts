// Optional auth middleware - attaches user to request if valid token present; does not fail if no/invalid token
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getConfig } from '../../infrastructure/config/config.loader';

export const optionalAuthMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    const token = authHeader.slice(7);
    const config = getConfig();
    const decoded = jwt.verify(token, config.JWT_SECRET) as { sub: string; email?: string; role?: string; type: string };
    if (decoded.type !== 'access') {
      return next();
    }
    req.user = { id: parseInt(decoded.sub, 10), email: decoded.email ?? '', role: decoded.role ?? 'user' };
    next();
  } catch {
    next();
  }
};
