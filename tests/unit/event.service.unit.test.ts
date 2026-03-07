// Unit tests: EventService - listEvents, getEventById, createEvent, updateEvent
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventService } from '../../src/application/services/event.service';
import { AppError } from '../../src/shared/errors/app.error';
import { EVB404001 } from '../../src/shared/constants/error-code.constants';

const mockClient = {};

function createMocks() {
  const executeInTransaction = vi.fn((fn: (c: unknown) => Promise<unknown>) => fn(mockClient));
  const transactionManager = { executeInTransaction };

  const eventRepo = {
    findAll: vi.fn(),
    findById: vi.fn(),
    createWithClient: vi.fn(),
    updateWithClient: vi.fn(),
  };

  const eventAuditRepo = { insert: vi.fn() };

  return { transactionManager, eventRepo, eventAuditRepo };
}

const mockEvent = {
  id: 1,
  name: 'Test Event',
  description: 'Desc',
  capacity: 10,
  booked_count: 2,
  remaining_spots: 8,
  status: 'published' as const,
  created_at: new Date(),
};

describe('EventService', () => {
  let service: EventService;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
    mocks.eventAuditRepo.insert.mockResolvedValue(undefined);
    service = new EventService(
      mocks.eventRepo as never,
      mocks.eventAuditRepo as never,
      mocks.transactionManager as never
    );
  });

  describe('listEvents', () => {
    it('returns events and pagination', async () => {
      mocks.eventRepo.findAll.mockResolvedValue({
        events: [mockEvent],
        total: 1,
      });
      const result = await service.listEvents({ page: 1, limit: 10 });
      expect(result.events).toHaveLength(1);
      expect(result.events[0].name).toBe('Test Event');
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBe(1);
    });

    it('filters by public statuses when not admin', async () => {
      mocks.eventRepo.findAll.mockResolvedValue({ events: [], total: 0 });
      await service.listEvents({ page: 1, limit: 10 });
      expect(mocks.eventRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ statuses: ['published', 'coming_soon'] })
      );
    });
  });

  describe('getEventById', () => {
    it('throws 404 when event not found', async () => {
      mocks.eventRepo.findById.mockResolvedValue(null);
      await expect(service.getEventById(999)).rejects.toThrow(AppError);
      await expect(service.getEventById(999)).rejects.toMatchObject({ errorCode: EVB404001 });
    });

    it('throws 404 when event is draft and not admin', async () => {
      mocks.eventRepo.findById.mockResolvedValue({ ...mockEvent, status: 'draft' });
      await expect(service.getEventById(1)).rejects.toThrow(AppError);
      await expect(service.getEventById(1)).rejects.toMatchObject({ errorCode: EVB404001 });
    });

    it('returns event when published', async () => {
      mocks.eventRepo.findById.mockResolvedValue(mockEvent);
      const result = await service.getEventById(1);
      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Event');
      expect(result.remaining_spots).toBe(8);
    });
  });

  describe('createEvent', () => {
    it('creates event and returns dto', async () => {
      mocks.eventRepo.createWithClient.mockResolvedValue(mockEvent);
      const result = await service.createEvent(
        { name: 'New Event', description: 'Desc', capacity: 50 },
        1
      );
      expect(result.name).toBe('Test Event');
      expect(mocks.eventAuditRepo.insert).toHaveBeenCalled();
    });
  });

  describe('updateEvent', () => {
    it('throws 404 when event not found', async () => {
      mocks.eventRepo.updateWithClient.mockResolvedValue(null);
      await expect(service.updateEvent(999, { name: 'Updated' }, 1)).rejects.toThrow(AppError);
      await expect(service.updateEvent(999, { name: 'Updated' }, 1)).rejects.toMatchObject({ errorCode: EVB404001 });
    });

    it('returns updated event on success', async () => {
      const updated = { ...mockEvent, name: 'Updated Name' };
      mocks.eventRepo.updateWithClient.mockResolvedValue(updated);
      const result = await service.updateEvent(1, { name: 'Updated Name' }, 1);
      expect(result.name).toBe('Updated Name');
    });
  });
});
