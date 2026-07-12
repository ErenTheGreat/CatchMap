import type { NearbySpot } from '@/utils/osmFishingSpots';
import type { SpotDiscoveryScore } from '@/utils/spotDiscoveryScore';

export interface BiteHeatmapCell {
  latitude: number;
  longitude: number;
  score: number;
}

export interface BiteHeatmapGeoJson {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { score: number; opacity: number };
  }>;
}

export type BiteHeatmapStatus = 'ready' | 'needs_more_spots' | 'no_scores';

const MIN_SCORED_WATER_SPOTS = 3;
const WATER_BRIDGE_MAX_KM = 1.5;

const WATER_ACCESS_TYPES = new Set(['boat_ramp', 'marina']);

function getSpotScore(
  spotId: string,
  scores: Record<string, SpotDiscoveryScore>
): number {
  const score = scores[spotId];
  if (!score) return 1;
  return score.rawScore ?? score.activityRating ?? 1;
}

function distanceKm(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number
): number {
  const dLat = (latB - latA) * 111;
  const dLon = (lonB - lonA) * 111 * Math.cos((latA * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

function getScoredSpots(
  spots: NearbySpot[],
  scores: Record<string, SpotDiscoveryScore>
): NearbySpot[] {
  return spots.filter((spot) => scores[spot.id] != null);
}

/** Water bodies only — excludes ramps, marinas, and other shore access POIs. */
export function isWaterBodySpot(spot: NearbySpot): boolean {
  if (spot.poiType === 'access_ramp' || spot.poiType === 'marina') return false;
  if (WATER_ACCESS_TYPES.has(spot.water_type)) return false;
  return true;
}

function getScoredWaterSpots(
  spots: NearbySpot[],
  scores: Record<string, SpotDiscoveryScore>
): NearbySpot[] {
  return getScoredSpots(spots, scores).filter(isWaterBodySpot);
}

function buildWaterHeatmapPoints(
  waterSpots: NearbySpot[],
  scores: Record<string, SpotDiscoveryScore>
): BiteHeatmapCell[] {
  const points: BiteHeatmapCell[] = waterSpots.map((spot) => ({
    latitude: spot.latitude,
    longitude: spot.longitude,
    score: getSpotScore(spot.id, scores),
  }));

  for (let i = 0; i < waterSpots.length; i++) {
    for (let j = i + 1; j < waterSpots.length; j++) {
      const left = waterSpots[i];
      const right = waterSpots[j];
      const spanKm = distanceKm(
        left.latitude,
        left.longitude,
        right.latitude,
        right.longitude
      );
      if (spanKm <= 0 || spanKm > WATER_BRIDGE_MAX_KM) continue;

      points.push({
        latitude: (left.latitude + right.latitude) / 2,
        longitude: (left.longitude + right.longitude) / 2,
        score:
          (getSpotScore(left.id, scores) + getSpotScore(right.id, scores)) / 2,
      });
    }
  }

  return points;
}

export function getBiteHeatmapStatus(
  spots: NearbySpot[],
  scores: Record<string, SpotDiscoveryScore>
): BiteHeatmapStatus {
  const waterSpots = getScoredWaterSpots(spots, scores);
  if (waterSpots.length === 0) return 'no_scores';
  if (waterSpots.length < MIN_SCORED_WATER_SPOTS) return 'needs_more_spots';
  return 'ready';
}

/**
 * Builds a GeoJSON overlay with glow points placed on water fishing spots only.
 */
export function buildBiteHeatmapGeoJson(
  spots: NearbySpot[],
  scores: Record<string, SpotDiscoveryScore>
): BiteHeatmapGeoJson | null {
  const waterSpots = getScoredWaterSpots(spots, scores);
  if (waterSpots.length < MIN_SCORED_WATER_SPOTS) return null;

  const cells = buildWaterHeatmapPoints(waterSpots, scores);
  if (cells.length === 0) return null;

  let maxScore = 0;
  for (const cell of cells) {
    maxScore = Math.max(maxScore, cell.score);
  }
  if (maxScore <= 0) return null;

  return {
    type: 'FeatureCollection',
    features: cells.map((cell) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [cell.longitude, cell.latitude],
      },
      properties: {
        score: Math.round(cell.score * 10) / 10,
        opacity: Math.min(0.6, 0.2 + (cell.score / maxScore) * 0.35),
      },
    })),
  };
}
