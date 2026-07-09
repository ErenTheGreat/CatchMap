import type { ActivityRating, AvailableSpecies, SpeciesPrediction } from '@/lib/types/speciesPrediction';
import type { CatchTimeSlot } from '@/lib/types/spotDetails';
import type { NearbySpot } from '@/utils/recommendations';
import type { SpeciesRig } from '@/lib/types/speciesRigs';

export interface SpeciesCatalogEntry {
  id: string;
  name: string;
  scientificName: string;
  habitat: string;
  description: string;
  averageWeight: string;
  maxWeight: string;
  season: string;
  bestMonths: number[];
  peakMonths: number[];
  regions: string[];
  waterTypes: string[];
  lures: string[];
  hookSize: string;
  bait: string[];
  image: string;
  tips: string;
}

export interface LocationSpeciesGuide {
  species: AvailableSpecies;
  prediction?: SpeciesPrediction;
  activityRating: ActivityRating;
  howToCatch: string;
  hookSize: string | null;
  bait: string[];
  lures: string[];
  habitat: string | null;
  averageWeight: string | null;
  imageUrl: string | null;
  locationContext: string;
  bestCatchTimes: CatchTimeSlot[];
  hasCatalogData: boolean;
  primaryRig?: SpeciesRig;
  alternateRigs?: SpeciesRig[];
}

export interface BuildLocationSpeciesGuideOptions {
  species: AvailableSpecies;
  prediction?: SpeciesPrediction;
  spot: NearbySpot;
  bestCatchTimes?: CatchTimeSlot[];
}
