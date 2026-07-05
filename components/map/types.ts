import { NearbySpot } from '@/utils/osmFishingSpots';
import { BBox } from '@/lib/api/endpoints/spatialSpots';

export interface FishingMapProps {
  latitude: number;
  longitude: number;
  nearbySpots: NearbySpot[];
  onSpotPress?: (spot: NearbySpot) => void;
  /** Fires when the camera settles on a new region — [minLon, minLat, maxLon, maxLat] */
  onRegionChange?: (bbox: BBox) => void;
}

/**
 * Free, keyless vector style (OpenStreetMap data served as vector tiles).
 * Used by both the native MapLibre view and the MapLibre GL JS fallback.
 */
export const VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
