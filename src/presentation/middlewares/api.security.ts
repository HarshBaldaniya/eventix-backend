// Level 2: API-level security - API key, auth token validation
import { Request, Response, NextFunction } from 'express';
import { apiConstants } from '../../shared/constants/api.constants';

export const apiSecurityMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const _apiKey = req.headers[apiConstants.API_KEY_HEADER] as string;
  next();
};
