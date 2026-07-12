import type { ActivityRating as NumericActivityRating } from '@/utils/fishingEngine';

export type CoachFactorImpact = '+' | '-' | 'neutral';

export interface CoachFactor {
  name: string;
  impact: CoachFactorImpact;
  detail: string;
}

export interface CatchCoachSetup {
  rigName: string;
  lureLabel: string;
  retrieve?: string;
  targetDepth?: string;
  tip?: string;
  rigId?: string;
}

export interface CatchCoachCommunity {
  topLures: string[];
  catchCount: number;
}

export interface CatchCoachPersonal {
  message: string;
  topLure?: string;
  bestHour?: number;
}

export interface CatchCoachAdvice {
  speciesName: string;
  headline: string;
  setup: CatchCoachSetup;
  technique: string;
  whyNow: CoachFactor[];
  community?: CatchCoachCommunity;
  personal?: CatchCoachPersonal;
  biteRating?: NumericActivityRating;
  confidence: 'high' | 'medium' | 'low';
  hasCatalogData: boolean;
}
