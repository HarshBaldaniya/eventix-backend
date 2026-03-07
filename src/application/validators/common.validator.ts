// Shared Zod schemas for params and query - DRY, reusable across routes
import { z } from 'zod';

/** Positive integer ID from route params (e.g. /events/:id, /bookings/:id) */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('ID must be a positive integer'),
});

/** Pagination query params - page, limit with sensible defaults */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type IdParam = z.infer<typeof idParamSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
