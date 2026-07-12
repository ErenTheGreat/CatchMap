import { getMaxWaypoints } from '@/constants/pro';
import { getProEntitled } from '@/lib/pro/proState';

export interface WaypointRecord {
  id: string;
  name: string;
  notes: string;
  latitude: number;
  longitude: number;
  createdAt: number;
  updatedAt: number;
}

export const MAX_WAYPOINTS = 200;

/** @deprecated Use getMaxWaypointsLimit() for tier-aware caps. */
export const LEGACY_MAX_WAYPOINTS = 50;

export function getMaxWaypointsLimit(): number {
  return getMaxWaypoints(getProEntitled());
}

export function generateWaypointId(): string {
  return `wp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
