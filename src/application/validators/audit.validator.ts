// Zod schema for audit log list query params
import { z } from 'zod';

export const auditLogListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  resource_type: z.enum(['event', 'booking']).optional(),
  event_id: z.coerce.number().int().positive().optional(),
  booking_id: z.coerce.number().int().positive().optional(),
  outcome: z.enum(['success', 'failure']).optional(),
  date_from: z.string().optional().transform((s) => {
    if (!s) return undefined;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) throw new Error('Invalid date_from');
    return d;
  }),
  date_to: z.string().optional().transform((s) => {
    if (!s) return undefined;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) throw new Error('Invalid date_to');
    return d;
  }),
});

export type AuditLogListQuery = z.infer<typeof auditLogListQuerySchema>;
