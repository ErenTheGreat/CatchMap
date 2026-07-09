import { useMemo } from 'react';
import { useCatches } from '@/hooks/useCatches';
import { buildPersonalBiteFingerprint } from '@/utils/personalBiteFingerprint';
import type { PersonalBiteFingerprint } from '@/lib/types/personalBite';

const EMPTY_FINGERPRINT: PersonalBiteFingerprint = {
  unlocked: false,
  catchesUntilUnlock: 10,
  totalCatchesWithConditions: 0,
  topFactors: [],
  headline: 'Log catches with weather conditions to unlock your personal bite fingerprint.',
  speciesPatterns: [],
};

export function usePersonalBiteFingerprint() {
  const { data: catches = [], isLoading } = useCatches();

  const fingerprint = useMemo(
    () => (catches.length > 0 ? buildPersonalBiteFingerprint(catches) : EMPTY_FINGERPRINT),
    [catches]
  );

  return { fingerprint, catches, isLoading };
}
