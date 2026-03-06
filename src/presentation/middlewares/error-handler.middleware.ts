// Global error handler middleware - catches all errors and returns consistent response
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/app.error';
import { appLogger } from '../../shared/logger/app.logger';
import { LOG_LABEL } from '../../shared/constants/log-label.constants';
import { STATUS_CODE_INTERNAL_SERVER_ERROR } from '../../shared/constants/status-code.constants';
import { ERROR_CODE_INTERNAL } from '../../shared/constants/error-code.constants';

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
    });
    res.status(err.statusCode).json({
      success: false,
      errorCode: err.errorCode,
      message: err.message,
    });
    return;
  }
  appLogger.error({
    label: LOG_LABEL.ERROR_HANDLER,
    msg: err.message,
    stack: err.stack,
  });
  res.status(STATUS_CODE_INTERNAL_SERVER_ERROR).json({
    success: false,
    errorCode: ERROR_CODE_INTERNAL,
    message: 'Internal server error',
  });
};
