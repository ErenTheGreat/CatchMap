import { isVerifiedSpeciesSource } from '@/lib/api/endpoints/speciesPrediction';
import { getPrimaryLureLabel, getPrimaryRigForName, getRigTypeLabel } from '@/utils/speciesRigs';
import type { PersonalSpeciesNear } from '@/lib/types/catchInsights';
import type {
  DataConfidence,
  PredictionFactor,
  SpeciesPrediction,
  SpeciesSource,
} from '@/lib/types/speciesPrediction';
import { MIN_PROBABILITY } from '@/lib/species/scoreSpeciesPrediction';
import type { HourlyBiteForecast } from '@/lib/api/endpoints/weather';
import type { NearbySpot } from '@/utils/osmFishingSpots';
import type { RankedDiscoverySpot } from '@/utils/spotDiscoveryScore';
import {
  buildGoNowLabel,
  getBestTripWindow,
  type TripWindow,
} from '@/utils/tripPlanner';

export const SPECIES_TARGET_SPOT_LIMIT = 6;
export const MAX_SPECIES_TARGETS = 3;
/** Higher bar than spot-level display — top picks only. */
export const MIN_TARGET_PROBABILITY = 22;

export interface TodaySpeciesTarget {
  speciesId: string;
  speciesName: string;
  /** Normalized 0–100 score for display sorting. */
  matchScore: number;
  probability: number;
  activityRating: SpeciesPrediction['activityRating'];
  bestSpot: NearbySpot;
  bestSpotBiteRating: number;
  bestSpotBiteLabel: string;
  factors: PredictionFactor[];
  dataConfidence: DataConfidence;
  source?: SpeciesSource;
  rigLabel: string | null;
  rigTypeLabel: string | null;
  personalMatch: boolean;
  supportingSpotCount: number;
  bestWindow: TripWindow | null;
  goNowLabel: string;
}

export interface RankTodaySpeciesTargetsInput {
  rankedSpots: RankedDiscoverySpot[];
  speciesBySpotId: Record<string, SpeciesPrediction[]>;
  personalSpecies?: PersonalSpeciesNear[];
  maxTargets?: number;
  spotLimit?: number;
  now?: Date;
}

interface SpeciesAggregate {
  speciesId: string;
  speciesName: string;
  bestComposite: number;
  bestPrediction: SpeciesPrediction;
  bestSpot: NearbySpot;
  bestBiteRating: number;
  bestBiteLabel: string;
  supportingSpotCount: number;
  personalMatch: boolean;
  hourlyForecast: HourlyBiteForecast[];
}

function normalizeSpeciesName(name: string): string {
  return name.trim().toLowerCase();
}

function buildPersonalSpeciesSet(personalSpecies?: PersonalSpeciesNear[]): Set<string> {
  const set = new Set<string>();
  for (const item of personalSpecies ?? []) {
    if (item.species.trim()) {
      set.add(normalizeSpeciesName(item.species));
    }
  }
  return set;
}

function confidenceMultiplier(
  confidence?: DataConfidence,
  source?: SpeciesSource
): number {
  if (source === 'category') return 0.55;
  switch (confidence) {
    case 'high':
      return 1;
    case 'medium':
      return 0.92;
    default:
      return 0.75;
  }
}

function isEligibleTarget(prediction: SpeciesPrediction): boolean {
  if (prediction.probability < MIN_PROBABILITY) return false;
  if (prediction.source === 'category' && prediction.dataConfidence === 'low') {
    return false;
  }
  if (!isVerifiedSpeciesSource(prediction.source) && prediction.probability < MIN_TARGET_PROBABILITY) {
    return false;
  }
  return true;
}

function compositeScore(
  prediction: SpeciesPrediction,
  biteRating: number,
  personalMatch: boolean
): number {
  const biteFactor = Math.pow(Math.max(1, biteRating) / 5, 1.15);
  const confFactor = confidenceMultiplier(prediction.dataConfidence, prediction.source);
  const personalFactor = personalMatch ? 1.14 : 1;
  return prediction.probability * biteFactor * confFactor * personalFactor;
}

function toDisplayMatchScore(composite: number): number {
  return Math.round(Math.min(99, Math.max(0, composite)));
}

function pickTopFactors(factors: PredictionFactor[], limit = 3): PredictionFactor[] {
  const positives = factors.filter((factor) => factor.impact === '+');
  const neutral = factors.filter((factor) => factor.impact === 'neutral');
  return [...positives, ...neutral].slice(0, limit);
}

function buildRigLabels(
  speciesId: string,
  speciesName: string
): { rigLabel: string | null; rigTypeLabel: string | null } {
  const primary = getPrimaryRigForName(speciesName);
  const rigLabel =
    getPrimaryLureLabel(speciesId) ??
    primary?.components.find((component) => component.role === 'lure' || component.role === 'bait')
      ?.label ??
    null;
  const rigTypeLabel = primary ? getRigTypeLabel(primary.rigType) : null;
  return { rigLabel, rigTypeLabel };
}

export function rankTodaySpeciesTargets(
  input: RankTodaySpeciesTargetsInput
): TodaySpeciesTarget[] {
  const {
    rankedSpots,
    speciesBySpotId,
    personalSpecies,
    maxTargets = MAX_SPECIES_TARGETS,
    spotLimit = SPECIES_TARGET_SPOT_LIMIT,
    now = new Date(),
  } = input;

  if (rankedSpots.length === 0) return [];

  const personalSet = buildPersonalSpeciesSet(personalSpecies);
  const aggregates = new Map<string, SpeciesAggregate>();

  for (const { spot, score } of rankedSpots.slice(0, spotLimit)) {
    const predictions = speciesBySpotId[spot.id];
    if (!predictions?.length) continue;

    for (const prediction of predictions) {
      if (!isEligibleTarget(prediction)) continue;

      const personalMatch = personalSet.has(normalizeSpeciesName(prediction.name));
      const composite = compositeScore(prediction, score.activityRating, personalMatch);
      const existing = aggregates.get(prediction.id);

      if (!existing || composite > existing.bestComposite) {
        aggregates.set(prediction.id, {
          speciesId: prediction.id,
          speciesName: prediction.name,
          bestComposite: composite,
          bestPrediction: prediction,
          bestSpot: spot,
          bestBiteRating: score.activityRating,
          bestBiteLabel: score.label,
          supportingSpotCount: (existing?.supportingSpotCount ?? 0) + 1,
          personalMatch: existing?.personalMatch || personalMatch,
          hourlyForecast: score.hourlyForecast ?? [],
        });
      } else if (existing) {
        existing.supportingSpotCount += 1;
        existing.personalMatch = existing.personalMatch || personalMatch;
      }
    }
  }

  const ranked = [...aggregates.values()]
    .filter((item) => item.bestComposite >= MIN_TARGET_PROBABILITY)
    .sort((left, right) => {
      const scoreDiff = right.bestComposite - left.bestComposite;
      if (scoreDiff !== 0) return scoreDiff;
      return right.bestPrediction.probability - left.bestPrediction.probability;
    })
    .slice(0, maxTargets);

  return ranked.map((item) => {
    const { rigLabel, rigTypeLabel } = buildRigLabels(item.speciesId, item.speciesName);
    const bestWindow = getBestTripWindow(item.hourlyForecast, now);
    const goNowLabel = buildGoNowLabel(bestWindow, now);
    return {
      speciesId: item.speciesId,
      speciesName: item.speciesName,
      matchScore: toDisplayMatchScore(item.bestComposite),
      probability: item.bestPrediction.probability,
      activityRating: item.bestPrediction.activityRating,
      bestSpot: item.bestSpot,
      bestSpotBiteRating: item.bestBiteRating,
      bestSpotBiteLabel: item.bestBiteLabel,
      factors: pickTopFactors(item.bestPrediction.factors),
      dataConfidence: item.bestPrediction.dataConfidence ?? 'medium',
      source: item.bestPrediction.source,
      rigLabel,
      rigTypeLabel,
      personalMatch: item.personalMatch,
      supportingSpotCount: item.supportingSpotCount,
      bestWindow,
      goNowLabel,
    };
  });
}
