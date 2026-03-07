// Event controller - list events, get by ID, create, update (create/update admin only)
import { Request, Response } from 'express';
import { EventService } from '../../application/services/event.service';
import { STATUS_CODE_OK, STATUS_CODE_CREATED } from '../../shared/constants/status-code.constants';
import { asyncHandler } from '../middlewares/async-handler.middleware';
import {
  createEventSchema,
  updateEventSchema,
  listEventsQuerySchema,
  eventIdParamSchema,
} from '../../application/validators/event.validator';
import { parseOrThrow } from '../../shared/utils/validation.util';

export class EventController {
  constructor(private readonly eventService: EventService) { }

  createEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const body = parseOrThrow(createEventSchema, req.body);
    const userId = req.user?.id ?? 0;
    const result = await this.eventService.createEvent({ ...body, status: body.status ?? 'draft' }, userId);
    res.status(STATUS_CODE_CREATED).json({ success: true, data: result });
  });

  updateEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = parseOrThrow(eventIdParamSchema, req.params);
    const body = parseOrThrow(updateEventSchema, req.body);
    const userId = req.user?.id ?? 0;
    const result = await this.eventService.updateEvent(id, body, userId);
    res.status(STATUS_CODE_OK).json({ success: true, data: result });
  });

  listEvents = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const opts = parseOrThrow(listEventsQuerySchema, req.query);
    const asAdmin = req.user?.role === 'admin';
    const result = await this.eventService.listEvents({
      page: opts.page ?? 1,
      limit: opts.limit ?? 10,
      search: opts.search,
      status: opts.status,
      sort_by: opts.sort_by ?? 'created_at',
      order: opts.order ?? 'desc',
      asAdmin,
    });
    res.status(STATUS_CODE_OK).json({ success: true, data: result.events, pagination: result.pagination });
  });

  getEventById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = parseOrThrow(eventIdParamSchema, req.params);
    const asAdmin = req.user?.role === 'admin';
    const result = await this.eventService.getEventById(id, asAdmin);
    res.status(STATUS_CODE_OK).json({ success: true, data: result });
  });
}
