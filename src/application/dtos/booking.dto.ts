// Booking DTOs for request/response
export interface BookingResponseDto {
  id: number;
  event_id: number;
  user_id: number;
  ticket_count: number;
  status: 'confirmed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface BookingListDto {
  bookings: BookingResponseDto[];
  pagination: PaginationDto;
}

export interface CancelBookingDto {
  status: 'cancelled';
}

export interface PaginationDto {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}
