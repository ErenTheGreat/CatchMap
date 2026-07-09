import type { NearbySpot } from '@/utils/osmFishingSpots';

/** Lightweight spot record persisted on device (favorites + recents). */
export interface SavedSpotSnapshot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  water_type: string;
  description?: string | null;
  savedAt: number;
}

export interface RecentSpotSnapshot extends SavedSpotSnapshot {
  visitedAt: number;
}

export const MAX_SAVED_SPOTS = 30;
export const MAX_RECENT_SPOTS = 8;

export function nearbySpotToSnapshot(spot: NearbySpot, savedAt = Date.now()): SavedSpotSnapshot {
  return {
    id: spot.id,
    name: spot.name,
    latitude: spot.latitude,
    longitude: spot.longitude,
    water_type: spot.water_type,
    description: spot.description,
    savedAt,
  };
}

export function savedSpotToNearbySpot(
  snapshot: SavedSpotSnapshot,
  distance = 0
): NearbySpot {
  return {
    id: snapshot.id,
    name: snapshot.name,
    description: snapshot.description ?? null,
    latitude: snapshot.latitude,
    longitude: snapshot.longitude,
    water_type: snapshot.water_type,
    species: [],
    facilities: [],
    best_months: [],
    rating: 0,
    created_at: new Date(snapshot.savedAt).toISOString(),
    distance,
    matchedSpecies: [],
    isPeakSeason: false,
  };
}

export function snapshotFromRecent(recent: RecentSpotSnapshot): SavedSpotSnapshot {
  return {
    id: recent.id,
    name: recent.name,
    latitude: recent.latitude,
    longitude: recent.longitude,
    water_type: recent.water_type,
    description: recent.description,
    savedAt: recent.savedAt,
  };
}
