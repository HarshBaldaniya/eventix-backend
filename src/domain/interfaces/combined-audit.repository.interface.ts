// Combined audit repository - UNION of event_audit_log and booking_audit_log for list API
import type { AuditOperation, AuditOutcome } from '../../shared/constants/audit.constants';

export interface CombinedAuditListFilters {
  resource_type?: 'event' | 'booking';
  event_id?: number;
  booking_id?: number;
  outcome?: AuditOutcome;
  date_from?: Date;
  date_to?: Date;
  page: number;
  limit: number;
}

export interface CombinedAuditEntity {
  id: number;
  resource_type: 'event' | 'booking';
  operation: AuditOperation;
  event_id: number;
  booking_id: number | null;
  ticket_count: number | null;
  user_id: number | null;
  outcome: AuditOutcome;
  details: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
  created_at: Date;
}

export interface ICombinedAuditRepository {
  findAll(filters: CombinedAuditListFilters): Promise<{ logs: CombinedAuditEntity[]; total: number }>;
}
