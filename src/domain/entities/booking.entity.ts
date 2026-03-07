// Booking entity
export interface BookingEntity {
  id: number;
  event_id: number;
  user_id: number;
  ticket_count: number;
  status: 'confirmed' | 'cancelled';
  created_at: Date;
  updated_at: Date;
}
