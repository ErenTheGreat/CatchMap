import type { WaypointRecord } from '@/lib/types/waypoint';

export function waypointsToGeoJson(waypoints: WaypointRecord[]) {
  return {
    type: 'FeatureCollection' as const,
    features: waypoints.map((waypoint, index) => ({
      type: 'Feature' as const,
      id: index + 1,
      geometry: {
        type: 'Point' as const,
        coordinates: [waypoint.longitude, waypoint.latitude],
      },
      properties: {
        id: waypoint.id,
        name: waypoint.name,
        notes: waypoint.notes,
      },
    })),
  };
}
