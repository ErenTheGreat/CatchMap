export interface WaypointRecord {
  id: string;
  name: string;
  notes: string;
  latitude: number;
  longitude: number;
  createdAt: number;
  updatedAt: number;
}

export const MAX_WAYPOINTS = 50;

export function generateWaypointId(): string {
  return `wp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
