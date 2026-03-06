// Application error class with status and error codes

import { STATUS_CODE_INTERNAL_SERVER_ERROR } from '../constants/status-code.constants';
import { ERROR_CODE_INTERNAL } from '../constants/error-code.constants';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = STATUS_CODE_INTERNAL_SERVER_ERROR,
    errorCode: string = ERROR_CODE_INTERNAL,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}
