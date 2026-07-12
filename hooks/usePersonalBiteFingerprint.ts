import { useMemo } from 'react';
import { useCatches } from '@/hooks/useCatches';
import { usePro } from '@/providers/ProProvider';
import { buildPersonalBiteFingerprint } from '@/utils/personalBiteFingerprint';
import { applyProToFingerprint } from '@/lib/pro/proInsights';
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
  const { isPro } = usePro();

  const fingerprint = useMemo(() => {
    const base =
      catches.length > 0 ? buildPersonalBiteFingerprint(catches) : EMPTY_FINGERPRINT;
    return applyProToFingerprint(base);
  }, [catches, isPro]);

  return { fingerprint, catches, isLoading };
}
