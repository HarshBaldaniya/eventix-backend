// Event entity - includes computed remaining_spots
export interface EventEntity {
  id: number;
  name: string;
  description: string | null;
  capacity: number;
  booked_count: number;
  remaining_spots: number;
  status: 'draft' | 'coming_soon' | 'published' | 'cancelled' | 'completed';
  created_at: Date;
}
