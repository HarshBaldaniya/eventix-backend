// Reusable Zod string validators - special character and safety validation
import { z } from 'zod';

/** Regex: control characters (0x00-0x1F, 0x7F) except tab, newline, carriage return */
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;

/** Rejects strings containing control characters (except \t \n \r) and null bytes */
function noControlOrNullChars(val: string): boolean {
  return !CONTROL_CHARS_REGEX.test(val) && !val.includes('\x00');
}

/** Rejects strings with only whitespace (after trim) */
function notOnlyWhitespace(val: string): boolean {
  return val.trim().length > 0;
}

/** Event name: 1-255 chars, trim, no control chars, not empty after trim */
export const eventNameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(255, 'Name must be at most 255 characters')
  .transform((s) => s.trim())
  .refine(notOnlyWhitespace, 'Name cannot be only whitespace')
  .refine(noControlOrNullChars, {
    message: 'Name contains invalid or disallowed special characters',
  });

/** Search string: optional, trim, no control chars, max 200 (for query params) */
export const searchStringSchema = z
  .string()
  .max(200, 'Search must be at most 200 characters')
  .optional()
  .transform((s) => (s == null || s === '' ? undefined : s.trim() || undefined))
  .refine(
    (val) => val === undefined || noControlOrNullChars(val),
    'Search contains invalid or disallowed special characters'
  );

/** Ticket count: accepts number or string of digits only, no special characters, 1-100 */
export const ticketCountSchema = z
  .union([z.number(), z.string()])
  .transform((val) => (typeof val === 'string' ? val.trim() : String(val)))
  .refine((s) => /^\d+$/.test(s), {
    message: 'ticket_count must be a valid integer with no special characters',
  })
  .transform((s) => parseInt(s, 10))
  .refine((n) => n >= 1, 'ticket_count must be at least 1')
  .refine((n) => n <= 100, 'ticket_count must be at most 100')
  .optional()
  .default(1);

/** Event description: optional, 0-2000 chars, allows newlines/tabs, no other control chars */
export const eventDescriptionSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .optional()
  .transform((s) => {
    if (s == null || s === '') return null;
    const t = String(s).trim();
    return t === '' ? null : t;
  })
  .pipe(
    z.union([
      z.null(),
      z
        .string()
        .max(2000, 'Description must be at most 2000 characters')
        .refine(noControlOrNullChars, {
          message: 'Description contains invalid or disallowed special characters',
        }),
    ])
  );
