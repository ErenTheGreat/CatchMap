import type { CatchActivityRow } from '@/lib/types/speciesPrediction';
import type { SpeciesPrediction } from '@/lib/types/speciesPrediction';
import type { LocationSpeciesGuide } from '@/lib/types/speciesGuide';
import type {
  CatchCoachAdvice,
  CatchCoachPersonal,
  CoachFactor,
} from '@/lib/types/catchCoach';
import type { CatchRecord } from '@/utils/storage';
import type { BestTimeNowResult } from '@/utils/bestTimeNow';
import {
  getHourlyCatchDistribution,
  getTopLures,
  MIN_CATCHES_FOR_INSIGHTS,
} from '@/utils/catchInsights';
import { getCommunityTopLures } from '@/utils/communityCatchIntel';
import { findSpeciesCatalogEntry } from '@/utils/speciesGuide';
import { getPrimaryRigForName } from '@/utils/speciesRigs';
import type { ActivityRating as NumericActivityRating } from '@/utils/fishingEngine';

const EARTH_RADIUS_KM = 6371;
const PERSONAL_NEAR_RADIUS_KM = 5;

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeSpeciesName(name: string): string {
  return name.trim().toLowerCase();
}

function speciesMatches(left: string, right: string): boolean {
  const a = normalizeSpeciesName(left);
  const b = normalizeSpeciesName(right);
  return a === b || a.includes(b) || b.includes(a);
}

function filterCommunityRowsForSpecies(
  rows: CatchActivityRow[],
  speciesName: string
): CatchActivityRow[] {
  return rows.filter((row) => speciesMatches(row.speciesName, speciesName));
}

function getRigLureLabel(
  rig: NonNullable<ReturnType<typeof getPrimaryRigForName>>
): string | null {
  const terminal = rig.components.find(
    (component) => component.role === 'lure' || component.role === 'bait'
  );
  return terminal?.label ?? null;
}

function mapPredictionImpact(impact: '+' | '-' | 'neutral'): CoachFactor['impact'] {
  return impact;
}

function activityRatingToNumeric(
  prediction?: SpeciesPrediction,
  bestTime?: BestTimeNowResult | null
): NumericActivityRating | undefined {
  if (prediction?.score != null) {
    return Math.max(1, Math.min(5, Math.round(prediction.score))) as NumericActivityRating;
  }
  if (bestTime?.activityRating != null) {
    return bestTime.activityRating;
  }
  return undefined;
}

function buildHeadline(
  speciesName: string,
  prediction?: SpeciesPrediction,
  bestTime?: BestTimeNowResult | null
): string {
  if (prediction?.activityRating === 'High') {
    return `Strong bite window for ${speciesName} — conditions are lining up`;
  }
  if (bestTime?.label) {
    return `${bestTime.label}: good time to target ${speciesName}`;
  }
  if (prediction?.activityRating === 'Low') {
    return `Slow period for ${speciesName} — finesse and patience will help`;
  }
  return `Your best approach for ${speciesName} right now`;
}

function buildPersonalAdvice(
  speciesName: string,
  catches: CatchRecord[],
  latitude?: number | null,
  longitude?: number | null
): CatchCoachPersonal | undefined {
  if (catches.length < MIN_CATCHES_FOR_INSIGHTS) return undefined;

  const speciesCatches = catches.filter((c) => speciesMatches(c.species, speciesName));
  if (speciesCatches.length === 0) return undefined;

  const topLures = getTopLures(speciesCatches, 1);
  const topLure = topLures[0]?.lure;

  let bestHour: number | undefined;
  if (latitude != null && longitude != null) {
    const nearby = speciesCatches.filter(
      (c) =>
        c.latitude != null &&
        c.longitude != null &&
        distanceKm(latitude, longitude, c.latitude, c.longitude) <= PERSONAL_NEAR_RADIUS_KM
    );
    const hours = getHourlyCatchDistribution(nearby.length > 0 ? nearby : speciesCatches);
    bestHour = hours[0]?.hour;
  } else {
    const hours = getHourlyCatchDistribution(speciesCatches);
    bestHour = hours[0]?.hour;
  }

  const parts: string[] = [];
  if (topLure) {
    parts.push(`You've had success with ${topLure}`);
  }
  if (bestHour != null) {
    const hourLabel =
      bestHour === 0
        ? 'midnight'
        : bestHour < 12
          ? `${bestHour} AM`
          : bestHour === 12
            ? 'noon'
            : `${bestHour - 12} PM`;
    parts.push(`your best hour for this species is around ${hourLabel}`);
  }

  if (parts.length === 0) {
    return {
      message: `You've logged ${speciesCatches.length} ${speciesName} — keep building your pattern.`,
      topLure,
      bestHour,
    };
  }

  return {
    message: parts.join(', and '),
    topLure,
    bestHour,
  };
}

function buildWhyNowFactors(
  prediction?: SpeciesPrediction,
  bestTime?: BestTimeNowResult | null
): CoachFactor[] {
  const factors: CoachFactor[] = [];
  const seen = new Set<string>();

  for (const factor of prediction?.factors ?? []) {
    if (seen.has(factor.name)) continue;
    seen.add(factor.name);
    factors.push({
      name: factor.name,
      impact: mapPredictionImpact(factor.impact),
      detail: factor.detail,
    });
    if (factors.length >= 4) break;
  }

  for (const factor of bestTime?.factors ?? []) {
    if (seen.has(factor.name)) continue;
    seen.add(factor.name);
    factors.push({
      name: factor.name,
      impact: factor.impact,
      detail: factor.detail,
    });
    if (factors.length >= 6) break;
  }

  return factors;
}

function computeConfidence(
  hasLocation: boolean,
  hasCommunity: boolean,
  hasPersonal: boolean,
  hasCatalog: boolean
): CatchCoachAdvice['confidence'] {
  if (hasLocation && hasCatalog && (hasCommunity || hasPersonal)) return 'high';
  if (hasLocation && hasCatalog) return 'medium';
  return 'low';
}

export interface BuildCatchCoachAdviceOptions {
  speciesName: string;
  guide?: LocationSpeciesGuide | null;
  prediction?: SpeciesPrediction;
  bestTime?: BestTimeNowResult | null;
  communityRows?: CatchActivityRow[];
  catches?: CatchRecord[];
  latitude?: number | null;
  longitude?: number | null;
}

export function buildCatchCoachAdvice(
  options: BuildCatchCoachAdviceOptions
): CatchCoachAdvice | null {
  const speciesName = options.speciesName?.trim();
  if (!speciesName) return null;

  const catalogEntry = findSpeciesCatalogEntry(speciesName);
  const guide = options.guide ?? null;
  const primaryRig = guide?.primaryRig ?? getPrimaryRigForName(speciesName);
  const hasCatalogData = guide?.hasCatalogData ?? !!catalogEntry;

  const rigLureLabel = primaryRig ? getRigLureLabel(primaryRig) : null;
  const catalogLure = catalogEntry?.lures[0] ?? '';
  const lureLabel = rigLureLabel ?? catalogLure ?? 'your go-to lure';

  const techniqueParts = [
    guide?.locationContext,
    guide?.howToCatch ?? catalogEntry?.tips,
  ].filter(Boolean);

  let technique =
    techniqueParts.join(' ').trim() || `Work typical ${speciesName} structure and cover.`;

  if (options.prediction?.activityRating === 'High') {
    technique = `Active fish expected — ${technique}`;
  } else if (options.prediction?.activityRating === 'Low') {
    technique = `Slow bite likely — downsize and slow down. ${technique}`;
  }

  if (options.bestTime?.label) {
    technique = `${options.bestTime.label}: ${technique}`;
  }

  const speciesCommunityRows = filterCommunityRowsForSpecies(
    options.communityRows ?? [],
    speciesName
  );
  const communityCatchCount = speciesCommunityRows.reduce(
    (sum, row) => sum + row.catchCount,
    0
  );
  const communityTopLures = getCommunityTopLures(
    speciesCommunityRows.length > 0 ? speciesCommunityRows : (options.communityRows ?? []),
    3
  );

  const personal = buildPersonalAdvice(
    speciesName,
    options.catches ?? [],
    options.latitude,
    options.longitude
  );

  const hasLocation = options.latitude != null && options.longitude != null;

  return {
    speciesName,
    headline: buildHeadline(speciesName, options.prediction, options.bestTime),
    setup: {
      rigName: primaryRig?.name ?? `${speciesName} setup`,
      lureLabel,
      retrieve: primaryRig?.retrieve,
      targetDepth: primaryRig?.targetDepth,
      tip: primaryRig?.tip,
      rigId: primaryRig?.id,
    },
    technique,
    whyNow: buildWhyNowFactors(options.prediction, options.bestTime),
    community:
      communityCatchCount > 0
        ? { topLures: communityTopLures, catchCount: communityCatchCount }
        : undefined,
    personal,
    biteRating: activityRatingToNumeric(options.prediction, options.bestTime),
    confidence: computeConfidence(
      hasLocation,
      communityCatchCount > 0,
      !!personal,
      hasCatalogData
    ),
    hasCatalogData,
  };
}
