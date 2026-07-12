export interface SpotDnaPersonalStats {
  totalCatches: number;
  bestMonth?: { label: string; count: number };
  topSpecies?: { name: string; count: number };
  goToRig?: { lure: string; count: number; total: number };
}

export interface SpotDnaCommunityStats {
  totalCatches: number;
  topSpecies?: { name: string; count: number };
  topLures: string[];
  daysBack: number;
}

export interface SpotDnaProfile {
  spotId: string;
  spotName: string;
  personal: SpotDnaPersonalStats | null;
  community: SpotDnaCommunityStats | null;
  regulationCount: number;
  hasPersonalHistory: boolean;
  headline: string;
}
