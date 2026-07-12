import type { SavedSpotSnapshot } from '@/lib/types/savedSpot';
import type { PersonalBiteFingerprint } from '@/lib/types/personalBite';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import { buildCatchConditions } from '@/utils/catchConditions';
import {
  computePersonalPatternMatch,
  getMatchingFactorLabels,
} from '@/utils/personalBiteFingerprint';

export const PATTERN_MATCH_ALERT_THRESHOLD = 70;

export interface PatternMatchResult {
  spotId: string;
  spotName: string;
  matchScore: number;
  matchingFactors: string[];
  windowLabel?: string;
}

export function evaluateSavedSpotPatternMatch(
  spot: SavedSpotSnapshot,
  fingerprint: PersonalBiteFingerprint,
  weather: WeatherSnapshot | null | undefined,
  windowStart?: Date
): PatternMatchResult | null {
  if (!fingerprint.unlocked || !weather) return null;

  const referenceTime = windowStart ?? new Date();
  const conditions = buildCatchConditions(weather);
  const matchScore = computePersonalPatternMatch(fingerprint, {
    hour: referenceTime.getHours(),
    conditions,
  });

  if (matchScore < PATTERN_MATCH_ALERT_THRESHOLD) return null;

  return {
    spotId: spot.id,
    spotName: spot.name,
    matchScore,
    matchingFactors: getMatchingFactorLabels(fingerprint, {
      hour: referenceTime.getHours(),
      conditions,
    }),
    windowLabel: windowStart
      ? windowStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : undefined,
  };
}

export function formatPatternMatchNotificationBody(result: PatternMatchResult): string {
  const factors =
    result.matchingFactors.length > 0
      ? ` Matches: ${result.matchingFactors.join(', ')}.`
      : '';
  const window = result.windowLabel ? ` Window starts ${result.windowLabel}.` : '';
  return `${result.matchScore}% match to your best days.${window}${factors}`;
}

export function formatPatternMatchNotificationTitle(spotName: string): string {
  return `Pattern match — ${spotName}`;
}

export function pickBestPatternMatch(
  results: PatternMatchResult[]
): PatternMatchResult | null {
  if (results.length === 0) return null;
  return [...results].sort((a, b) => b.matchScore - a.matchScore)[0] ?? null;
}
