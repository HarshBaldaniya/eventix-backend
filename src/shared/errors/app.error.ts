// Application error class with status and error codes

import { STATUS_CODE_INTERNAL_SERVER_ERROR } from '../constants/status-code.constants';
import { EVB500001 } from '../constants/error-code.constants';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = STATUS_CODE_INTERNAL_SERVER_ERROR,
    errorCode: string = EVB500001,
    details?: Record<string, unknown>,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}
