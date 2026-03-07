// Unit tests: AuditLogService - listAuditLog
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditLogService } from '../../src/application/services/audit-log.service';

function createMocks() {
  const combinedAuditRepo = { findAll: vi.fn() };
  return { combinedAuditRepo };
}

describe('AuditLogService', () => {
  let service: AuditLogService;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
    service = new AuditLogService(mocks.combinedAuditRepo as never);
  });

  describe('listAuditLog', () => {
    it('returns entries and pagination', async () => {
      mocks.combinedAuditRepo.findAll.mockResolvedValue({
        logs: [
          {
            id: 1,
            resource_type: 'event',
            operation: 'create',
            event_id: 1,
            booking_id: null,
            user_id: 1,
            ticket_count: null,
            outcome: 'success',
            details: {},
            error_code: null,
            error_message: null,
            created_at: new Date(),
          },
        ],
        total: 1,
      });
      const result = await service.listAuditLog({ page: 1, limit: 10 });
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].resource_type).toBe('event');
      expect(result.entries[0].operation).toBe('create');
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBe(1);
    });

    it('passes filters to repository', async () => {
      mocks.combinedAuditRepo.findAll.mockResolvedValue({ logs: [], total: 0 });
      await service.listAuditLog({
        page: 2,
        limit: 5,
        resource_type: 'booking',
        event_id: 1,
      });
      expect(mocks.combinedAuditRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          limit: 5,
          resource_type: 'booking',
          event_id: 1,
        })
      );
    });
  });
});
