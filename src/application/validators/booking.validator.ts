// Zod schemas for booking validation
import { z } from 'zod';
import { idParamSchema, paginationQuerySchema } from './common.validator';
import { ticketCountSchema } from './string.validators';

export { idParamSchema };
export const bookingIdParamSchema = idParamSchema;

/** For POST /events/:id/bookings - ticket_count from body (optional, default 1) */
export const bookSpotForEventSchema = z
  .object({
    ticket_count: ticketCountSchema,
  })
  .strict('Unknown fields are not allowed');

/** For PATCH /bookings/:id - accepts empty body or { status: 'cancelled' } */
export const cancelSchema = z
  .object({ status: z.literal('cancelled').optional() })
  .strict('Unknown fields are not allowed')
  .default({})
  .transform(() => ({ status: 'cancelled' as const }));

/** Query params for GET /bookings */
export const listBookingsQuerySchema = paginationQuerySchema;

export type BookSpotForEventInput = z.infer<typeof bookSpotForEventSchema>;
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
