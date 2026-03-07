// Event DTOs for response
export type EventStatus = 'draft' | 'coming_soon' | 'published' | 'cancelled' | 'completed';

export interface EventResponseDto {
  id: number;
  name: string;
  description: string | null;
  capacity: number;
  booked_count: number;
  remaining_spots: number;
  status: EventStatus;
  created_at: string;
  max_tickets_per_booking?: number;
}

export interface EventListDto {
  events: EventResponseDto[];
  pagination: PaginationDto;
}

export interface PaginationDto {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}
