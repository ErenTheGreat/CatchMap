import type { NearbySpot } from '@/utils/osmFishingSpots';

export interface CategorizedSpotCategory {
  category: string;
  spots: NearbySpot[];
}

export type CategorizedSpotsResponse = CategorizedSpotCategory[];

/** Raw spot row returned inside each category from the RPC. */
export interface CategorizedSpotRow {
  id: string;
  name: string;
  water_type: string;
  latitude: number;
  longitude: number;
  distance_miles: number;
}

/** Raw category group from `get_categorized_spots_in_bbox`. */
export interface CategorizedSpotGroupRow {
  category: string;
  spots: CategorizedSpotRow[];
}
