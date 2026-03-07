// Global error handler middleware - standard envelope per tech spec
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/app.error';
import { appLogger } from '../../shared/logger/app.logger';
import { LOG_LABEL } from '../../shared/constants/log-label.constants';
import { STATUS_CODE_INTERNAL_SERVER_ERROR } from '../../shared/constants/status-code.constants';
import { EVB500001 } from '../../shared/constants/error-code.constants';

/** Standard error response shape - always includes code, message, details */
export interface ErrorResponseBody {
  success: false;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

function sendErrorResponse(res: Response, statusCode: number, code: string, message: string, details?: Record<string, unknown>): void {
  if (res.headersSent) return;
  const body: ErrorResponseBody = {
    success: false,
    error: {
      code,
      message,
      details: details ?? {},
    },
  };
  res.status(statusCode).json(body);
}

export const errorHandlerMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    appLogger.error({
      label: LOG_LABEL.ERROR_HANDLER,
      msg: err.message,
      statusCode: err.statusCode,
      errorCode: err.errorCode,
      details: err.details,
    });
    sendErrorResponse(res, err.statusCode, err.errorCode, err.message, err.details);
    return;
  }
  appLogger.error({
    label: LOG_LABEL.ERROR_HANDLER,
    msg: err.message,
    stack: err.stack,
  });
  sendErrorResponse(res, STATUS_CODE_INTERNAL_SERVER_ERROR, EVB500001, 'An unexpected error occurred. Please try again later.');
};
