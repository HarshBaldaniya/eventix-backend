// Reusable Zod validation - Single Responsibility: parse or throw AppError
import type { ZodType, ZodError } from 'zod';
import { AppError } from '../errors/app.error';
import { STATUS_CODE_BAD_REQUEST } from '../constants/status-code.constants';
import { EVB400001 } from '../constants/error-code.constants';

function formatZodDetails(error: ZodError): Record<string, string> {
  const details: Record<string, string> = {};
  error.errors.forEach((e) => {
    const path = e.path.join('.') || 'body';
    if (!details[path]) details[path] = e.message;
  });
  return details;
}

// Parses data with Zod schema. Returns typed result or throws AppError with validation details.
export function parseOrThrow<T>(schema: ZodType<T, any, any>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const details = formatZodDetails(result.error);
  throw new AppError('Validation failed', STATUS_CODE_BAD_REQUEST, EVB400001, details);
}
