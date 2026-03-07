// Event audit log repository - create, update operations on events
import type { AuditOperation, AuditOutcome } from '../../shared/constants/audit.constants';

export type EventAuditOperation = 'create' | 'update';

export interface EventAuditInsert {
  operation: EventAuditOperation;
  event_id: number;
  user_id?: number | null;
  outcome: AuditOutcome;
  details?: Record<string, unknown> | null;
  error_code?: string | null;
  error_message?: string | null;
}

export interface EventAuditEntity {
  id: number;
  operation: AuditOperation;
  event_id: number;
  user_id: number | null;
  outcome: AuditOutcome;
  details: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
  created_at: Date;
}

export interface EventAuditListFilters {
  event_id?: number;
  outcome?: AuditOutcome;
  date_from?: Date;
  date_to?: Date;
  page: number;
  limit: number;
}

export interface IEventAuditRepository {
  insert(data: EventAuditInsert, client?: unknown): Promise<void>;
  findAll(filters: EventAuditListFilters): Promise<{ logs: EventAuditEntity[]; total: number }>;
}
