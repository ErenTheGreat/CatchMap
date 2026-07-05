import { NearbySpot } from '@/utils/osmFishingSpots';

export function spotsToGeoJson(spots: NearbySpot[]) {
  return {
    type: 'FeatureCollection' as const,
    features: spots.map((spot) => ({
      type: 'Feature' as const,
      id: spot.id,
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
        depth: spot.avgDepthFeet ?? null,
        season: spot.bestSeason ?? null,
      },
    })),
  };
}
