import type { CatchTimeSlot } from '@/lib/types/spotDetails';

export interface SpeciesBreakdownItem {
  species: string;
  count: number;
  pct: number;
}

export interface TopSpotCluster {
  label: string;
  lat: number;
  lon: number;
  count: number;
}

export interface LureStat {
  lure: string;
  count: number;
}

export interface MonthBreakdownItem {
  month: number;
  label: string;
  count: number;
}

export interface PersonalSpeciesNear {
  species: string;
  count: number;
}

export interface CatchInsights {
  totalCatches: number;
  hasEnoughData: boolean;
  hasGeoData: boolean;
  /** Catches still needed before pattern insights unlock (0 when unlocked). */
  catchesUntilUnlock: number;
  bestHours: CatchTimeSlot[];
  bestMonths: MonthBreakdownItem[];
  topSpecies: SpeciesBreakdownItem[];
  topSpots: TopSpotCluster[];
  topLures: LureStat[];
}
