import type { BBox } from '@/lib/api/endpoints/spatialSpots';
import { bboxCenter } from '@/lib/api/endpoints/categorizedSpots';
import { getLocalFishingSpots } from '@/lib/data/localSpots';
import type { NearbySpot } from '@/utils/osmFishingSpots';
import { calculateDistance } from '@/utils/geo';

function bboxRadiusMiles(bbox: BBox): number {
  const center = bboxCenter(bbox);
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const corners: Array<[number, number]> = [
    [minLat, minLng],
    [minLat, maxLng],
    [maxLat, minLng],
    [maxLat, maxLng],
  ];

  const maxCornerDistance = corners.reduce((max, [lat, lng]) => {
    const miles = calculateDistance(center.lat, center.lng, lat, lng);
    return Math.max(max, miles);
  }, 0);

  return Math.max(maxCornerDistance, 5);
}

function spotInsideBBox(spot: NearbySpot, bbox: BBox): boolean {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return (
    spot.latitude >= minLat &&
    spot.latitude <= maxLat &&
    spot.longitude >= minLng &&
    spot.longitude <= maxLng
  );
}

/** Bundled Bay Area spots that fall inside the current map viewport. */
export function getBundledSpotsInBBox(bbox: BBox): NearbySpot[] {
  const center = bboxCenter(bbox);
  const radiusMiles = bboxRadiusMiles(bbox);
  return getLocalFishingSpots(center.lat, center.lng, radiusMiles).filter((spot) =>
    spotInsideBBox(spot, bbox)
  );
}
