// Global error handler: Formats application and unexpected errors for API responses
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/app.error';
import { STATUS_CODE_INTERNAL_SERVER_ERROR } from '../../shared/constants/status-code.constants';
import { EVB500001 } from '../../shared/constants/error-code.constants';
import { appLogger } from '../../shared/logger/app.logger';
import { LOG_LABEL } from '../../shared/constants/log-label.constants';

export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.errorCode,
        message: err.message,
        details: err.details,
        request_id: (req as any).requestId,
      },
    });
    return;
  }
  appLogger.error({
    label: LOG_LABEL.APPLICATION,
    msg: 'Unhandled error',
    err,
    requestId: (req as any).requestId,
  });
  res.status(STATUS_CODE_INTERNAL_SERVER_ERROR).json({
    success: false,
    error: {
      code: EVB500001,
      message: 'Internal server error',
      request_id: (req as any).requestId,
    },
  });
};
