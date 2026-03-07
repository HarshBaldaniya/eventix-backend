// Validation utility: Reusable wrapper for Zod schemas with standard AppError reporting
import { z } from 'zod';
import { AppError } from '../errors/app.error';
import { STATUS_CODE_BAD_REQUEST } from '../constants/status-code.constants';
import { EVB400001 } from '../constants/error-code.constants';

export function validateRequest<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const msg = Object.entries(errors)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ');
    throw new AppError(`Validation failed: ${msg}`, STATUS_CODE_BAD_REQUEST, EVB400001, { validation_errors: errors });
  }
  return result.data;
}

export const parseOrThrow = validateRequest;
