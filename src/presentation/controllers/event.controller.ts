// Event controller: Orchestrates listing, retrieval, creation, and updating of event data
import { Request, Response } from 'express';
import { EventService } from '../../application/services/event.service';
import { createEventSchema, updateEventSchema, listEventsQuerySchema } from '../../application/validators/event.validator';
import { validateRequest } from '../../shared/utils/validation.util';
import { STATUS_CODE_CREATED, STATUS_CODE_OK } from '../../shared/constants/status-code.constants';
import { asyncHandler } from '../middlewares/async-handler.middleware';

export class EventController {
  constructor(private readonly eventService: EventService) { }

  listEvents = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data = validateRequest(listEventsQuerySchema, req.query);
    const asAdmin = (req as any).user?.role === 'admin';
    const result = await this.eventService.listEvents({ ...data, asAdmin });
    res.status(STATUS_CODE_OK).json({ success: true, data: result.events, pagination: result.pagination });
  });

  getEventById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id!, 10);
    const asAdmin = (req as any).user?.role === 'admin';
    const result = await this.eventService.getEventById(id, asAdmin);
    res.status(STATUS_CODE_OK).json({ success: true, data: result });
  });

  createEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data = validateRequest(createEventSchema, req.body);
    const result = await this.eventService.createEvent(data, (req as any).user.id);
    res.status(STATUS_CODE_CREATED).json({ success: true, data: result });
  });

  updateEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id!, 10);
    const data = validateRequest(updateEventSchema, req.body);
    const result = await this.eventService.updateEvent(id, data, (req as any).user.id);
    res.status(STATUS_CODE_OK).json({ success: true, data: result });
  });
}

