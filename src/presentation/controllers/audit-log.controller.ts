// Audit log controller: Exposes combined administrative audit trails for events and bookings
import { Request, Response } from 'express';
import { AuditLogService } from '../../application/services/audit-log.service';
import { auditLogListQuerySchema } from '../../application/validators/audit.validator';
import { validateRequest } from '../../shared/utils/validation.util';
import { STATUS_CODE_OK } from '../../shared/constants/status-code.constants';
import { asyncHandler } from '../middlewares/async-handler.middleware';

export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) { }

  listAuditLog = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data = validateRequest(auditLogListQuerySchema, req.query);
    const result = await this.auditLogService.listAuditLog(data);
    res.status(STATUS_CODE_OK).json({ success: true, data: result.entries, pagination: result.pagination });
  });
}

