// Event booking config - default + per-event overrides
export interface EventBookingConfig {
  max_tickets_per_booking: number;
  max_tickets_per_user: number;
}

export interface IEventBookingConfigRepository {
  getForEvent(eventId: number): Promise<EventBookingConfig>;
}
