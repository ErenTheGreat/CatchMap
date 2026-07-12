import type { CatchRecord } from '@/utils/storage';
import { getMonthName } from '@/utils/recommendations';
import type {
  CatchInsights,
  LureStat,
  MonthBreakdownItem,
  PersonalSpeciesNear,
  SpeciesBreakdownItem,
  TopSpotCluster,
} from '@/lib/types/catchInsights';
import {
  type CatchTimeSlot,
  formatCatchHourLabel,
} from '@/lib/types/spotDetails';

const EARTH_RADIUS_KM = 6371;
const DEFAULT_NEAR_RADIUS_KM = 5;
const SPOT_CLUSTER_RADIUS_KM = 0.8; // ~0.5 mi
export const MIN_CATCHES_FOR_INSIGHTS = 3;

function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getCatchHour(c: CatchRecord): number {
  const ts = c.createdAt || new Date(c.date).getTime();
  return new Date(ts).getHours();
}

function hasGeo(c: CatchRecord): c is CatchRecord & { latitude: number; longitude: number } {
  return c.latitude != null && c.longitude != null;
}

export function getHourlyCatchDistribution(catches: CatchRecord[]): CatchTimeSlot[] {
  const hourCounts = new Map<number, number>();

  for (const c of catches) {
    const hour = getCatchHour(c);
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }

  return Array.from(hourCounts.entries())
    .map(([hour, catchCount]) => ({
      hour,
      label: formatCatchHourLabel(hour),
      catchCount,
    }))
    .sort((a, b) => b.catchCount - a.catchCount);
}

export function getPersonalCatchTimesNear(
  lat: number,
  lon: number,
  catches: CatchRecord[],
  radiusKm: number = DEFAULT_NEAR_RADIUS_KM
): CatchTimeSlot[] {
  const nearby = catches.filter(
    (c) => hasGeo(c) && distanceKm(lat, lon, c.latitude, c.longitude) <= radiusKm
  );
  return getHourlyCatchDistribution(nearby);
}

export function getTopSpots(catches: CatchRecord[], limit: number = 3): TopSpotCluster[] {
  const geoCatches = catches.filter(hasGeo);
  const clusters: { lat: number; lon: number; count: number; name?: string }[] = [];

  for (const c of geoCatches) {
    let merged = false;
    for (const cluster of clusters) {
      if (distanceKm(c.latitude, c.longitude, cluster.lat, cluster.lon) <= SPOT_CLUSTER_RADIUS_KM) {
        const total = cluster.count + 1;
        cluster.lat = (cluster.lat * cluster.count + c.latitude) / total;
        cluster.lon = (cluster.lon * cluster.count + c.longitude) / total;
        cluster.count = total;
        if (!cluster.name && c.locationName) {
          cluster.name = c.locationName;
        }
        merged = true;
        break;
      }
    }
    if (!merged) {
      clusters.push({
        lat: c.latitude,
        lon: c.longitude,
        count: 1,
        name: c.locationName ?? undefined,
      });
    }
  }

  return clusters
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((cluster) => ({
      label: cluster.name ?? `${cluster.lat.toFixed(2)}°, ${cluster.lon.toFixed(2)}°`,
      lat: cluster.lat,
      lon: cluster.lon,
      count: cluster.count,
    }));
}

export function getSpeciesBreakdown(catches: CatchRecord[]): SpeciesBreakdownItem[] {
  const counts = new Map<string, number>();
  for (const c of catches) {
    counts.set(c.species, (counts.get(c.species) ?? 0) + 1);
  }

  const total = catches.length || 1;
  return Array.from(counts.entries())
    .map(([species, count]) => ({
      species,
      count,
      pct: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

export function getPersonalSpeciesNear(
  lat: number,
  lon: number,
  catches: CatchRecord[],
  radiusKm: number = DEFAULT_NEAR_RADIUS_KM,
  limit: number = 3
): PersonalSpeciesNear[] {
  const nearby = catches.filter(
    (c) => hasGeo(c) && distanceKm(lat, lon, c.latitude, c.longitude) <= radiusKm
  );
  const counts = new Map<string, number>();
  for (const c of nearby) {
    counts.set(c.species, (counts.get(c.species) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([species, count]) => ({ species, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function getCatchMonth(c: CatchRecord): number {
  const ts = c.createdAt || new Date(c.date).getTime();
  return new Date(ts).getMonth() + 1;
}

export function getBestMonths(catches: CatchRecord[], limit: number = 3): MonthBreakdownItem[] {
  const monthCounts = new Map<number, number>();
  for (const c of catches) {
    const month = getCatchMonth(c);
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
  }
  return Array.from(monthCounts.entries())
    .map(([month, count]) => ({
      month,
      label: getMonthName(month),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getTopLures(catches: CatchRecord[], limit: number = 3): LureStat[] {
  const counts = new Map<string, number>();
  for (const c of catches) {
    const lure = c.lure?.trim();
    if (!lure) continue;
    counts.set(lure, (counts.get(lure) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([lure, count]) => ({ lure, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Returns the set of catch ids that are the heaviest recorded for their
 * species — i.e. the angler's personal best for that fish.
 */
export function getPersonalBestCatchIds(catches: CatchRecord[]): Set<string> {
  const bestBySpecies = new Map<string, { id: string; weight: number }>();

  for (const c of catches) {
    const weight = parseFloat(c.weight);
    if (!Number.isFinite(weight) || weight <= 0) continue;
    const current = bestBySpecies.get(c.species);
    if (!current || weight > current.weight) {
      bestBySpecies.set(c.species, { id: c.id, weight });
    }
  }

  return new Set(Array.from(bestBySpecies.values()).map((b) => b.id));
}

export function buildCatchInsights(catches: CatchRecord[]): CatchInsights {
  const geoCatches = catches.filter(hasGeo);
  const hasEnoughData = catches.length >= MIN_CATCHES_FOR_INSIGHTS;

  return {
    totalCatches: catches.length,
    hasEnoughData,
    hasGeoData: geoCatches.length > 0,
    catchesUntilUnlock: hasEnoughData
      ? 0
      : Math.max(0, MIN_CATCHES_FOR_INSIGHTS - catches.length),
    bestHours: getHourlyCatchDistribution(catches).slice(0, 3),
    bestMonths: getBestMonths(catches, 3),
    topSpecies: getSpeciesBreakdown(catches).slice(0, 5),
    topSpots: getTopSpots(catches, 3),
    topLures: getTopLures(catches, 3),
  };
}
