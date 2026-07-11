import { useCallback, useMemo } from 'react';
import { useCatches } from '@/hooks/useCatches';
import { buildCatchInsights, getPersonalCatchTimesNear, getPersonalSpeciesNear } from '@/utils/catchInsights';
import { buildPersonalBiteFingerprint } from '@/utils/personalBiteFingerprint';
import { applyProToFingerprint, applyProToInsights } from '@/lib/pro/proInsights';
import type { CatchInsights } from '@/lib/types/catchInsights';
import type { PersonalBiteFingerprint } from '@/lib/types/personalBite';
import type { CatchTimeSlot } from '@/lib/types/spotDetails';

const EMPTY_FINGERPRINT: PersonalBiteFingerprint = {
  unlocked: false,
  catchesUntilUnlock: 10,
  totalCatchesWithConditions: 0,
  topFactors: [],
  headline: 'Log catches with weather conditions to unlock your personal bite fingerprint.',
  speciesPatterns: [],
};

const EMPTY_INSIGHTS: CatchInsights = {
  totalCatches: 0,
  hasEnoughData: false,
  hasGeoData: false,
  catchesUntilUnlock: 3,
  bestHours: [],
  bestMonths: [],
  topSpecies: [],
  topSpots: [],
  topLures: [],
};

export function useCatchInsights() {
  const { data: catches = [], isLoading, isRefetching, refetch } = useCatches();

  const insights = useMemo(() => {
    const base = catches.length > 0 ? buildCatchInsights(catches) : EMPTY_INSIGHTS;
    return applyProToInsights(base);
  }, [catches]);

  const fingerprint = useMemo(() => {
    const base =
      catches.length > 0 ? buildPersonalBiteFingerprint(catches) : EMPTY_FINGERPRINT;
    return applyProToFingerprint(base);
  }, [catches]);

  const getPersonalCatchTimesNearPoint = useCallback(
    (lat: number, lon: number, radiusKm?: number): CatchTimeSlot[] =>
      getPersonalCatchTimesNear(lat, lon, catches, radiusKm),
    [catches]
  );

  const getPersonalSpeciesNearPoint = useCallback(
    (lat: number, lon: number, radiusKm?: number) =>
      getPersonalSpeciesNear(lat, lon, catches, radiusKm),
    [catches]
  );

  return {
    catches,
    insights,
    fingerprint,
    isLoading,
    isRefetching,
    refetch,
    getPersonalCatchTimesNear: getPersonalCatchTimesNearPoint,
    getPersonalSpeciesNear: getPersonalSpeciesNearPoint,
  };
}
