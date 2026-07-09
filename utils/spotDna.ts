import type { SpotDnaProfile } from '@/lib/types/spotDna';
import type { CatchRecord } from '@/utils/storage';
import type { CommunityCatchSummary } from '@/utils/communityCatchIntel';
import type { RegulationNotice } from '@/lib/types/fishingRegulations';
import type { NearbySpot } from '@/utils/recommendations';
import { getMonthName } from '@/utils/recommendations';

const EARTH_RADIUS_KM = 6371;
const SPOT_RADIUS_KM = 0.8;

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function filterCatchesNearSpot(catches: CatchRecord[], spot: NearbySpot): CatchRecord[] {
  return catches.filter(
    (c) =>
      c.latitude != null &&
      c.longitude != null &&
      distanceKm(c.latitude, c.longitude, spot.latitude, spot.longitude) <= SPOT_RADIUS_KM
  );
}

function buildPersonalStats(nearby: CatchRecord[]): SpotDnaProfile['personal'] {
  if (nearby.length === 0) return null;

  const monthCounts = new Map<number, number>();
  const speciesCounts = new Map<string, number>();
  const lureCounts = new Map<string, number>();

  for (const c of nearby) {
    const month = new Date(c.createdAt || c.date).getMonth() + 1;
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
    speciesCounts.set(c.species, (speciesCounts.get(c.species) ?? 0) + 1);
    if (c.lure?.trim()) {
      lureCounts.set(c.lure.trim(), (lureCounts.get(c.lure.trim()) ?? 0) + 1);
    }
  }

  const bestMonthEntry = [...monthCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const topSpeciesEntry = [...speciesCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const topLureEntry = [...lureCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    totalCatches: nearby.length,
    bestMonth: bestMonthEntry
      ? { label: getMonthName(bestMonthEntry[0]), count: bestMonthEntry[1] }
      : undefined,
    topSpecies: topSpeciesEntry
      ? { name: topSpeciesEntry[0], count: topSpeciesEntry[1] }
      : undefined,
    goToRig: topLureEntry
      ? { lure: topLureEntry[0], count: topLureEntry[1], total: nearby.length }
      : undefined,
  };
}

function buildCommunityStats(summary: CommunityCatchSummary | null): SpotDnaProfile['community'] {
  if (!summary || summary.totalCatches === 0) return null;

  const topSpecies = summary.speciesBreakdown[0];
  return {
    totalCatches: summary.totalCatches,
    topSpecies: topSpecies
      ? { name: topSpecies.speciesName, count: topSpecies.catchCount }
      : undefined,
    topLures: summary.topLures,
    daysBack: summary.daysBack,
  };
}

function buildHeadline(
  spotName: string,
  personal: SpotDnaProfile['personal'],
  community: SpotDnaProfile['community']
): string {
  if (personal?.bestMonth) {
    return `Your best month at ${spotName}: ${personal.bestMonth.label} (${personal.bestMonth.count} catches).`;
  }
  if (community?.topSpecies) {
    return `Community activity: ${community.topSpecies.name} spike (${community.topSpecies.count} catches, last ${community.daysBack} days).`;
  }
  if (personal?.totalCatches) {
    return `You've logged ${personal.totalCatches} catches near ${spotName}.`;
  }
  return `Build your Spot DNA by logging catches at ${spotName}.`;
}

export function buildSpotDnaProfile(
  spot: NearbySpot,
  catches: CatchRecord[],
  communitySummary: CommunityCatchSummary | null,
  regulationNotices: RegulationNotice[]
): SpotDnaProfile {
  const nearby = filterCatchesNearSpot(catches, spot);
  const personal = buildPersonalStats(nearby);
  const community = buildCommunityStats(communitySummary);

  return {
    spotId: spot.id,
    spotName: spot.name,
    personal,
    community,
    regulationCount: regulationNotices.length,
    hasPersonalHistory: (personal?.totalCatches ?? 0) > 0,
    headline: buildHeadline(spot.name, personal, community),
  };
}
