import type { CatchConditions } from '@/utils/storage';

export type BiteFactorCategory = 'hour' | 'pressureTrend' | 'sky' | 'wind' | 'moon';

export interface PersonalBiteFactor {
  category: BiteFactorCategory;
  value: string;
  label: string;
  /** Normalized weight 0–1 relative to other factors for this profile. */
  weight: number;
  catchCount: number;
}

export interface SpeciesBitePattern {
  species: string;
  catchCount: number;
  topFactors: PersonalBiteFactor[];
  headline: string;
}

export interface PersonalBiteFingerprint {
  unlocked: boolean;
  catchesUntilUnlock: number;
  totalCatchesWithConditions: number;
  topFactors: PersonalBiteFactor[];
  headline: string;
  speciesPatterns: SpeciesBitePattern[];
}

export interface PersonalBiteBoost {
  boost: number;
  matchingFactors: PersonalBiteFactor[];
}

export interface CurrentConditionsSnapshot {
  hour?: number;
  conditions?: CatchConditions | null;
}

export const MIN_CATCHES_FOR_FINGERPRINT = 10;
