// Audit log controller - list entries (admin only), filters validated via Zod
import { Request, Response } from 'express';
import { AuditLogService } from '../../application/services/audit-log.service';
import type { CombinedAuditListFilters } from '../../domain/interfaces/combined-audit.repository.interface';
import { auditLogListQuerySchema } from '../../application/validators/audit.validator';
import { STATUS_CODE_OK } from '../../shared/constants/status-code.constants';
import { asyncHandler } from '../middlewares/async-handler.middleware';
import { parseOrThrow } from '../../shared/utils/validation.util';
import type { ZodType } from 'zod';

export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  listAuditLog = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const parsed = parseOrThrow(auditLogListQuerySchema as ZodType<CombinedAuditListFilters>, req.query);
    const filters = {
      page: parsed.page,
      limit: parsed.limit,
      resource_type: parsed.resource_type,
      event_id: parsed.event_id,
      booking_id: parsed.booking_id,
      outcome: parsed.outcome,
      date_from: parsed.date_from,
      date_to: parsed.date_to,
    };
    const result = await this.auditLogService.listAuditLog(filters);
    res.status(STATUS_CODE_OK).json({ success: true, data: result.entries, pagination: result.pagination });
  });
}
