import type { TidePrediction } from '@/lib/api/endpoints/tides';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import type { CatchActivityRow, SpeciesPrediction } from '@/lib/types/speciesPrediction';
import {
  computeCommunityActivityBoost,
  getCommunityCatchTotal,
} from '@/utils/communityCatchIntel';
import {
  computeBiteRawScore,
  getBestTimeNow,
  type BestTimeFactor,
  type NextWindow,
} from '@/utils/bestTimeNow';
import type { HourlyBiteForecast } from '@/lib/api/endpoints/weather';
import { getActivityLabel, type ActivityRating } from '@/utils/fishingEngine';
import type { NearbySpot } from '@/utils/osmFishingSpots';

export const MAX_DISCOVERY_SPOTS = 50;
export const HOT_NOW_MIN_RATING = 4 as const;
export const TOP_SPOTS_DISPLAY = 3;
export const ENRICHMENT_TOP_N = 6;

export type DiscoveryFilter = 'all' | 'hot' | 'nearest' | 'active';

export interface SpotDiscoveryScore {
  spotId: string;
  activityRating: ActivityRating;
  label: string;
  period: string;
  summary: string;
  tip: string;
  factors: BestTimeFactor[];
  nextWindow?: NextWindow;
  hourlyForecast: HourlyBiteForecast[];
  topSpeciesHint?: string;
  topSpeciesProbability?: number;
  enriched?: boolean;
  /** Un-tiered bite points (absolute conditions). */
  rawScore?: number;
  /** True when activityRating was assigned via viewport-relative ranking. */
  isRelativeTier?: boolean;
  /** Recent opt-in community catches near this spot (last 90 days). */
  communityCatchCount?: number;
  /** True when communityCatchCount > 0. */
  hasCommunityActivity?: boolean;
}

export interface SpotDiscoveryContext {
  weather?: WeatherSnapshot | null;
  tides?: TidePrediction[] | null;
  now?: Date;
  /** Personal bite fingerprint boost from matching user catch patterns. */
  personalBoost?: number;
  /** Per-spot trust boost from trip feedback accuracy. */
  trustBoostBySpotId?: Record<string, number>;
  /** Use date-specific hourly forecast (trip planner) instead of "next 12 hours". */
  tripPlanning?: boolean;
}

export interface RankedDiscoverySpot {
  spot: NearbySpot;
  score: SpotDiscoveryScore;
  rank: number;
}

interface DraftDiscoveryScore {
  spotId: string;
  rawScore: number;
  period: string;
  tip: string;
  factors: BestTimeFactor[];
  nextWindow?: NextWindow;
  hourlyForecast: HourlyBiteForecast[];
  topSpeciesHint?: string;
  topSpeciesProbability?: number;
  enriched?: boolean;
  communityCatchCount?: number;
  hasCommunityActivity?: boolean;
}

export function isSaltwaterSpot(waterType: string): boolean {
  return waterType === 'bay' || waterType === 'coastal' || waterType === 'saltwater';
}

function getSpotLocalBoost(spot: NearbySpot, context: SpotDiscoveryContext): number {
  let boost = 0;

  // Only use signals that vary per spot and are not category estimates.
  if ((spot.rating ?? 0) >= 4.5) boost += 0.2;
  if (isSaltwaterSpot(spot.water_type) && context.tides?.length) boost += 0.2;

  return boost;
}

function getSpeciesRawBoost(topSpecies?: SpeciesPrediction): number {
  if (!topSpecies) return 0;

  const probabilityBoost = (topSpecies.probability - 60) / 35;
  const scoreBoost = (topSpecies.score - 3) * 0.45;
  return probabilityBoost + scoreBoost;
}

function getDiscoveryRawScore(
  spot: NearbySpot,
  context: SpotDiscoveryContext,
  spotSpecies?: SpeciesPrediction[],
  communityActivity?: CatchActivityRow[]
): number {
  const topSpecies = spotSpecies?.[0];

  return (
    computeBiteRawScore({
      latitude: spot.latitude,
      longitude: spot.longitude,
      weather: context.weather ?? null,
      tides: isSaltwaterSpot(spot.water_type) ? (context.tides ?? null) : null,
      spotSpecies,
      date: context.now,
      dampenSharedSignals: true,
    }) +
    getSpotLocalBoost(spot, context) +
    getSpeciesRawBoost(topSpecies) +
    computeCommunityActivityBoost(communityActivity ?? []) +
    (context.personalBoost ?? 0) +
    (context.trustBoostBySpotId?.[spot.id] ?? 0)
  );
}

export function assignAbsoluteDiscoveryRating(rawScore: number): ActivityRating {
  const score = Math.round(rawScore * 10) / 10;
  if (score >= 5.6) return 5;
  if (score >= 4.9) return 4;
  if (score >= 3.8) return 3;
  if (score >= 2.6) return 2;
  return 1;
}

/** Percentile cutoffs for viewport-relative display tiers (best → worst). */
const RELATIVE_TIER_CUTOFFS: Array<{ maxRankFraction: number; rating: ActivityRating }> = [
  { maxRankFraction: 0.08, rating: 5 },
  { maxRankFraction: 0.2, rating: 4 },
  { maxRankFraction: 0.45, rating: 3 },
  { maxRankFraction: 0.75, rating: 2 },
  { maxRankFraction: 1, rating: 1 },
];

function relativeTierForRank(rank: number, total: number): ActivityRating {
  const fraction = (rank + 1) / total;
  for (const cutoff of RELATIVE_TIER_CUTOFFS) {
    if (fraction <= cutoff.maxRankFraction) {
      return cutoff.rating;
    }
  }
  return 1;
}

function finalizeDiscoveryScore(
  draft: DraftDiscoveryScore,
  activityRating: ActivityRating,
  options?: { isRelativeTier?: boolean }
): SpotDiscoveryScore {
  const label = getActivityLabel(activityRating);
  return {
    spotId: draft.spotId,
    activityRating,
    label,
    period: draft.period,
    summary: `${label} · ${draft.period}`,
    tip: draft.tip,
    factors: draft.factors,
    nextWindow: draft.nextWindow,
    hourlyForecast: draft.hourlyForecast,
    topSpeciesHint: draft.topSpeciesHint,
    topSpeciesProbability: draft.topSpeciesProbability,
    enriched: draft.enriched,
    rawScore: draft.rawScore,
    isRelativeTier: options?.isRelativeTier,
    communityCatchCount: draft.communityCatchCount,
    hasCommunityActivity: draft.hasCommunityActivity,
  };
}

/**
 * Map raw bite points to display tiers for the current viewport.
 * Uses relative ranking when multiple spots are visible (stable, deterministic).
 */
export function balanceViewportRatings(drafts: DraftDiscoveryScore[]): SpotDiscoveryScore[] {
  if (drafts.length === 0) return [];

  if (drafts.length === 1) {
    const draft = drafts[0];
    return [
      finalizeDiscoveryScore(draft, assignAbsoluteDiscoveryRating(draft.rawScore), {
        isRelativeTier: false,
      }),
    ];
  }

  const sorted = [...drafts].sort((left, right) => {
    const diff = right.rawScore - left.rawScore;
    if (diff !== 0) return diff;
    return left.spotId.localeCompare(right.spotId);
  });

  const tierBySpotId = new Map<string, ActivityRating>();
  sorted.forEach((draft, rank) => {
    tierBySpotId.set(draft.spotId, relativeTierForRank(rank, sorted.length));
  });

  return drafts.map((draft) =>
    finalizeDiscoveryScore(draft, tierBySpotId.get(draft.spotId) ?? 1, {
      isRelativeTier: true,
    })
  );
}

export function scoreSpotForDiscovery(
  spot: NearbySpot,
  context: SpotDiscoveryContext,
  spotSpecies?: SpeciesPrediction[],
  communityActivity?: CatchActivityRow[]
): SpotDiscoveryScore {
  const drafts = buildDiscoveryDrafts(
    [spot],
    context,
    spotSpecies ? new Map([[spot.id, spotSpecies]]) : undefined,
    communityActivity ? { [spot.id]: communityActivity } : undefined
  );
  return balanceViewportRatings(drafts)[0];
}

function buildDiscoveryDrafts(
  spots: NearbySpot[],
  context: SpotDiscoveryContext,
  enrichedBySpotId?: Map<string, SpeciesPrediction[]>,
  communityActivityBySpotId?: Record<string, CatchActivityRow[]>
): DraftDiscoveryScore[] {
  return spots.map((spot) => {
    const species = enrichedBySpotId?.get(spot.id);
    const communityActivity = communityActivityBySpotId?.[spot.id];
    const communityCatchCount = getCommunityCatchTotal(communityActivity ?? []);
    const bestTime = getBestTimeNow({
      latitude: spot.latitude,
      longitude: spot.longitude,
      weather: context.weather ?? null,
      tides: isSaltwaterSpot(spot.water_type) ? (context.tides ?? null) : null,
      spotSpecies: species,
      date: context.now,
      tripPlanning: context.tripPlanning,
    });
    const topSpecies = species?.[0];

    return {
      spotId: spot.id,
      rawScore: getDiscoveryRawScore(spot, context, species, communityActivity),
      period: bestTime.period,
      tip: bestTime.tip,
      factors: bestTime.factors,
      nextWindow: bestTime.nextWindow,
      hourlyForecast: bestTime.hourlyForecast,
      topSpeciesHint: topSpecies?.name,
      topSpeciesProbability: topSpecies?.probability,
      enriched: !!species?.length,
      communityCatchCount: communityCatchCount > 0 ? communityCatchCount : undefined,
      hasCommunityActivity: communityCatchCount > 0,
    };
  });
}

export function scoreSpotsForDiscovery(
  spots: NearbySpot[],
  context: SpotDiscoveryContext,
  enrichedBySpotId?: Map<string, SpeciesPrediction[]>,
  communityActivityBySpotId?: Record<string, CatchActivityRow[]>
): SpotDiscoveryScore[] {
  const capped = [...spots]
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_DISCOVERY_SPOTS);

  return balanceViewportRatings(
    buildDiscoveryDrafts(capped, context, enrichedBySpotId, communityActivityBySpotId)
  );
}

/** Trip planner: absolute bite tiers from live forecast, not viewport-relative ranking. */
export function scoreSpotsForTripPlanning(
  spots: NearbySpot[],
  context: SpotDiscoveryContext,
  enrichedBySpotId?: Map<string, SpeciesPrediction[]>,
  communityActivityBySpotId?: Record<string, CatchActivityRow[]>
): SpotDiscoveryScore[] {
  const capped = [...spots]
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_DISCOVERY_SPOTS);

  return buildDiscoveryDrafts(capped, context, enrichedBySpotId, communityActivityBySpotId).map(
    (draft) =>
      finalizeDiscoveryScore(draft, assignAbsoluteDiscoveryRating(draft.rawScore), {
        isRelativeTier: false,
      })
  );
}

export function buildScoresBySpotId(
  scores: SpotDiscoveryScore[]
): Record<string, SpotDiscoveryScore> {
  const map: Record<string, SpotDiscoveryScore> = {};
  for (const score of scores) {
    map[score.spotId] = score;
  }
  return map;
}

export function rankDiscoverySpots(
  spots: NearbySpot[],
  scoresBySpotId: Record<string, SpotDiscoveryScore>
): RankedDiscoverySpot[] {
  const ranked = spots
    .filter((spot) => scoresBySpotId[spot.id] != null)
    .map((spot) => ({
      spot,
      score: scoresBySpotId[spot.id],
    }))
    .sort((a, b) => {
      const ratingDiff = b.score.activityRating - a.score.activityRating;
      if (ratingDiff !== 0) return ratingDiff;
      return a.spot.distance - b.spot.distance;
    });

  return ranked.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

export function sortSpotsByDiscoveryScore(
  spots: NearbySpot[],
  scoresBySpotId: Record<string, SpotDiscoveryScore>
): NearbySpot[] {
  return [...spots].sort((a, b) => {
    const scoreA = scoresBySpotId[a.id]?.activityRating ?? 0;
    const scoreB = scoresBySpotId[b.id]?.activityRating ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.distance - b.distance;
  });
}

export function filterDiscoverySpots(
  spots: NearbySpot[],
  scoresBySpotId: Record<string, SpotDiscoveryScore>,
  filter: DiscoveryFilter
): NearbySpot[] {
  if (filter === 'nearest') {
    return [...spots].sort((a, b) => a.distance - b.distance);
  }

  const sorted = sortSpotsByDiscoveryScore(spots, scoresBySpotId);
  if (filter === 'active') {
    return sorted.filter((spot) => scoresBySpotId[spot.id]?.hasCommunityActivity);
  }
  if (filter === 'hot') {
    return sorted.filter(
      (spot) => (scoresBySpotId[spot.id]?.activityRating ?? 0) >= HOT_NOW_MIN_RATING
    );
  }
  return sorted;
}

export function getHourBucket(date: Date = new Date()): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
}

export function getCloseRankedSpots(
  ranked: RankedDiscoverySpot[],
  maxRatingGap = 0.5
): RankedDiscoverySpot[] {
  if (ranked.length < 2) return ranked.slice(0, TOP_SPOTS_DISPLAY);
  const topRating = ranked[0].score.activityRating;
  return ranked
    .filter((item) => topRating - item.score.activityRating <= maxRatingGap)
    .slice(0, TOP_SPOTS_DISPLAY);
}
