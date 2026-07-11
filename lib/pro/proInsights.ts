import { hasProPersonalInsights } from '@/constants/features';
import { MIN_CATCHES_FOR_FINGERPRINT } from '@/lib/types/personalBite';
import type { CatchInsights } from '@/lib/types/catchInsights';
import type { PersonalBiteFingerprint } from '@/lib/types/personalBite';
import { MIN_CATCHES_FOR_INSIGHTS } from '@/utils/catchInsights';

/** Pro users get full insights/fingerprint without catch-count unlock gates. */
export function applyProToInsights(insights: CatchInsights): CatchInsights {
  if (hasProPersonalInsights()) {
    if (insights.hasEnoughData || insights.totalCatches === 0) {
      return insights;
    }
    return {
      ...insights,
      hasEnoughData: true,
      catchesUntilUnlock: 0,
    };
  }

  if (insights.totalCatches >= MIN_CATCHES_FOR_INSIGHTS) {
    return {
      ...insights,
      hasEnoughData: false,
      catchesUntilUnlock: 0,
    };
  }

  return insights;
}

export function applyProToFingerprint(
  fingerprint: PersonalBiteFingerprint
): PersonalBiteFingerprint {
  if (hasProPersonalInsights()) {
    if (fingerprint.unlocked || fingerprint.totalCatchesWithConditions === 0) {
      return fingerprint;
    }
    return {
      ...fingerprint,
      unlocked: true,
      catchesUntilUnlock: 0,
      headline:
        fingerprint.topFactors.length > 0
          ? fingerprint.headline
          : 'Your personal bite fingerprint is active. Keep logging to refine patterns.',
    };
  }

  if (
    fingerprint.unlocked ||
    fingerprint.totalCatchesWithConditions >= MIN_CATCHES_FOR_FINGERPRINT
  ) {
    return {
      ...fingerprint,
      unlocked: false,
      catchesUntilUnlock: Math.max(
        0,
        MIN_CATCHES_FOR_FINGERPRINT - fingerprint.totalCatchesWithConditions
      ),
      headline: 'Upgrade to Pro to unlock your personal bite fingerprint.',
    };
  }

  return fingerprint;
}

export function insightsNeedsProUnlock(insights: CatchInsights): boolean {
  return (
    !hasProPersonalInsights() &&
    insights.totalCatches >= MIN_CATCHES_FOR_INSIGHTS &&
    !insights.hasEnoughData
  );
}

export function fingerprintNeedsProUnlock(fingerprint: PersonalBiteFingerprint): boolean {
  return (
    !hasProPersonalInsights() &&
    fingerprint.totalCatchesWithConditions >= MIN_CATCHES_FOR_FINGERPRINT &&
    !fingerprint.unlocked
  );
}
