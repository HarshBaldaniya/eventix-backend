// Audit log service: Retrieves combined event and booking audit entries for administrative review
import { ICombinedAuditRepository } from '../../domain/interfaces/combined-audit.repository.interface';
import type {
  CombinedAuditListFilters,
} from '../../domain/interfaces/combined-audit.repository.interface';
import type { PaginationDto } from '../dtos/event.dto';

export interface AuditLogEntryDto {
  id: number;
  resource_type: 'event' | 'booking';
  operation: string;
  event_id: number;
  booking_id: number | null;
  user_id: number | null;
  ticket_count?: number | null;
  outcome: string;
  details: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

export interface AuditLogListDto {
  entries: AuditLogEntryDto[];
  pagination: PaginationDto;
}

export class AuditLogService {
  constructor(private readonly combinedAuditRepo: ICombinedAuditRepository) { }

  async listAuditLog(filters: CombinedAuditListFilters): Promise<AuditLogListDto> {
    const { logs, total } = await this.combinedAuditRepo.findAll(filters);
    const { page, limit } = filters;
    const totalPages = Math.ceil(total / limit) || 1;
    const pagination: PaginationDto = {
      page,
      limit,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    };
    const entries: AuditLogEntryDto[] = logs.map((l) => ({
      id: l.id,
      resource_type: l.resource_type,
      operation: l.operation,
      event_id: l.event_id,
      booking_id: l.booking_id,
      user_id: l.user_id,
      ticket_count: l.ticket_count,
      outcome: l.outcome,
      details: l.details,
      error_code: l.error_code,
      error_message: l.error_message,
      created_at: l.created_at.toISOString(),
    }));
    return { entries, pagination };
  }
}
