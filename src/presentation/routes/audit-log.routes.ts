// Audit log routes - admin only
import { Router } from 'express';
import { AuditLogController } from '../controllers/audit-log.controller';
import { AuditLogService } from '../../application/services/audit-log.service';
import { CombinedAuditRepository } from '../../infrastructure/repositories/combined-audit.repository';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/require-role.middleware';

const router = Router();
const combinedAuditRepo = new CombinedAuditRepository();
const auditLogService = new AuditLogService(combinedAuditRepo);
const auditLogController = new AuditLogController(auditLogService);

router.get('/', authMiddleware, requireRole(['admin']), auditLogController.listAuditLog);

export const auditLogRoutes = router;
