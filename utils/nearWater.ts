import type { NearbySpot } from '@/utils/recommendations';

const EARTH_RADIUS_MILES = 3958.8;

export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const NEAR_WATER_THRESHOLD_MILES = 2;

export function findNearestWaterSpot(
  spots: NearbySpot[],
  latitude: number,
  longitude: number
): { spot: NearbySpot; distanceMiles: number } | null {
  if (spots.length === 0) return null;

  let best: { spot: NearbySpot; distanceMiles: number } | null = null;
  for (const spot of spots) {
    const distanceMiles = haversineMiles(latitude, longitude, spot.latitude, spot.longitude);
    if (!best || distanceMiles < best.distanceMiles) {
      best = { spot, distanceMiles };
    }
  }
  return best;
}

export function isNearWater(
  spots: NearbySpot[],
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  thresholdMiles = NEAR_WATER_THRESHOLD_MILES
): boolean {
  if (latitude == null || longitude == null) return false;
  const nearest = findNearestWaterSpot(spots, latitude, longitude);
  return nearest != null && nearest.distanceMiles <= thresholdMiles;
}
