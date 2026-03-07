// Role-based access - admin has all access; others must be in allowedRoles
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/app.error';
import { STATUS_CODE_FORBIDDEN } from '../../shared/constants/status-code.constants';
import { EVB403001 } from '../../shared/constants/error-code.constants';

export function requireRole(allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.user?.role ?? '';
    if (role === 'admin') {
      return next();
    }
    if (allowedRoles.includes(role)) {
      return next();
    }
    next(new AppError('You do not have permission to perform this action', STATUS_CODE_FORBIDDEN, EVB403001));
  };
}
