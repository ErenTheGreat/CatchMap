export type RegulationSeverity = 'info' | 'warning' | 'closed';

export interface RegulationNotice {
  id: string;
  severity: RegulationSeverity;
  title: string;
  message: string;
  regulationsUrl?: string;
}

export interface StateRegulationConfig {
  name: string;
  agency: string;
  regulationsUrl: string;
  licenseRequired: boolean;
  notes: {
    freshwater: string;
    coastal: string;
  };
  /** Optional viewport bounds for resolving state from coordinates. */
  bbox?: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

export interface ProtectedAreaConfig {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
  radiusKm: number;
  severity: 'warning' | 'closed';
  message: string;
}

export interface SpeciesRuleConfig {
  states: string[];
  waterTypes: string[];
  speciesName: string;
  /** Alternate common names that should match this rule. */
  speciesAliases?: string[];
  closedMonths: number[];
  message: string;
  minSizeInches?: number;
  bagLimit?: number;
  bagLimitNote?: string;
}

export type CatchRegulationSeasonStatus = 'open' | 'closed' | 'unknown';

export interface CatchSizeCheck {
  enteredInches: number | null;
  minSizeInches: number | null;
  passes: boolean | null;
}

export interface CatchRegulationCheck {
  status: RegulationSeverity;
  notices: RegulationNotice[];
  seasonStatus: CatchRegulationSeasonStatus;
  sizeCheck: CatchSizeCheck | null;
  bagLimit: number | null;
  bagLimitNote: string | null;
  regulationsUrl: string | null;
}

export interface FishingRegulationsData {
  states: Record<string, StateRegulationConfig>;
  protectedAreas: ProtectedAreaConfig[];
  speciesRules: SpeciesRuleConfig[];
  fallback: {
    title: string;
    message: string;
    regulationsUrl: string;
  };
}
