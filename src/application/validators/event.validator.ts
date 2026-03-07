// Zod schemas for event create/update (admin)
import { z } from 'zod';
import { idParamSchema } from './common.validator';
import { eventNameSchema, eventDescriptionSchema, searchStringSchema } from './string.validators';

export const eventIdParamSchema = idParamSchema;

export const eventStatusSchema = z.enum(['draft', 'coming_soon', 'published', 'cancelled', 'completed']);

export const createEventSchema = z
  .object({
    name: eventNameSchema,
    description: eventDescriptionSchema,
    capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1'),
    status: eventStatusSchema.optional().default('draft'),
  })
  .strict('Unknown fields are not allowed');

export const updateEventSchema = z
  .object({
    name: eventNameSchema.optional(),
    description: eventDescriptionSchema.optional(),
    capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1').optional(),
    status: eventStatusSchema.optional(),
  })
  .strict('Unknown fields are not allowed');

/** Query params for GET /events - validated and typed */
export const listEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: searchStringSchema,
  status: eventStatusSchema.optional(),
  sort_by: z.enum(['created_at', 'name', 'remaining_spots']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
export type EventIdParam = z.infer<typeof eventIdParamSchema>;
