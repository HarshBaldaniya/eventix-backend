// Health response validation - use for future health extensions
import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.enum(['connected', 'disconnected']),
});

export type HealthResponseSchema = z.infer<typeof healthResponseSchema>;
