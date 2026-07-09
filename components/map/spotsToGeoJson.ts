import { NearbySpot } from '@/utils/osmFishingSpots';
import type { SpotDiscoveryScore } from '@/utils/spotDiscoveryScore';

/** MapLibre clustering needs numeric feature ids; keep the app spot id in properties. */
function numericFeatureId(spotId: string, index: number): number {
  let hash = index + 1;
  for (let i = 0; i < spotId.length; i++) {
    hash = (hash * 31 + spotId.charCodeAt(i)) >>> 0;
  }
  return hash || index + 1;
}

export function spotsToGeoJson(
  spots: NearbySpot[],
  scoresBySpotId?: Record<string, SpotDiscoveryScore>
) {
  return {
    type: 'FeatureCollection' as const,
    features: spots
      .filter(
        (spot) =>
          Number.isFinite(spot.latitude) &&
          Number.isFinite(spot.longitude) &&
          spot.latitude >= -90 &&
          spot.latitude <= 90 &&
          spot.longitude >= -180 &&
          spot.longitude <= 180
      )
      .map((spot, index) => ({
        type: 'Feature' as const,
        id: numericFeatureId(spot.id, index),
        geometry: {
          type: 'Point' as const,
          coordinates: [spot.longitude, spot.latitude],
        },
        properties: {
          id: spot.id,
          name: spot.name,
          distance: spot.distance,
          waterType: spot.water_type,
          isPeak: spot.isPeakSeason ? 1 : 0,
          activityRating: scoresBySpotId?.[spot.id]?.activityRating ?? 0,
          communityCatchCount: scoresBySpotId?.[spot.id]?.communityCatchCount ?? 0,
          depth: spot.avgDepthFeet ?? null,
          season: spot.bestSeason ?? null,
          poiType: spot.poiType ?? 'water',
        },
      })),
  };
}
