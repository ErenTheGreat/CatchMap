import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';

export type FeedingZone = 'surface' | 'mid' | 'bottom';
export type SkyCondition = 'Clear' | 'Cloudy' | 'Rainy' | 'Stormy';
export type ActivityRating = 'High' | 'Moderate' | 'Low';
export type SpeciesSource =
  | 'location'
  | 'category'
  | 'presence'
  | 'bundled'
  | 'gbif'
  | 'gbif_discovered';
export type DataConfidence = 'high' | 'medium' | 'low';

export interface SpotContext {
  waterType: string;
  avgDepthFeet: number;
  underwaterStructure: string[];
  bestSeason: string;
  isSaltwater: boolean;
}

export interface AvailableSpecies {
  id: string;
  name: string;
  scientificName: string;
  imageUrl: string | null;
  feedingZone: FeedingZone;
  idealTempMin: number | null;
  idealTempMax: number | null;
  monthStart: number;
  monthEnd: number;
  peakMonths?: number[];
  habitat?: string | null;
  waterTypes?: string[];
  nocturnal?: boolean;
  source?: SpeciesSource;
  dataConfidence?: DataConfidence;
  /** False when GBIF documented the species but it is not in species.json yet. */
  inCatalog?: boolean;
}

export type PredictionFactorImpact = '+' | '-' | 'neutral';

export interface PredictionFactor {
  name: string;
  impact: PredictionFactorImpact;
  detail: string;
  weight: number;
}

export interface SpeciesPrediction extends AvailableSpecies {
  activityRating: ActivityRating;
  score: number;
  probability: number;
  factors: PredictionFactor[];
}

export interface SpeciesPredictionResult {
  predictions: SpeciesPrediction[];
  skyCondition: SkyCondition | null;
  temperatureF: number | null;
  spotContext: SpotContext | null;
  contextSubtitle: string | null;
}

export interface CatchActivityRow {
  speciesId: string;
  speciesName: string;
  catchCount: number;
  topLures: string[];
}

export interface SpeciesAvailabilityResult {
  species: AvailableSpecies[];
  spotContext: SpotContext | null;
}

/** Raw row from get_species_availability_for_location RPC. */
export interface SpeciesAvailabilityRow {
  species_id: string;
  species_name: string;
  scientific_name: string;
  image_url: string | null;
  feeding_zone: FeedingZone;
  ideal_temp_min: number | null;
  ideal_temp_max: number | null;
  month_start: number;
  month_end: number;
  source?: 'location' | 'category' | 'presence' | 'gbif' | 'gbif_discovered';
}

export function classifySkyCondition(weather: WeatherSnapshot): SkyCondition {
  if (weather.windSpeedMph >= 25 || weather.precipitationInch >= 0.15) {
    return 'Stormy';
  }
  if (weather.precipitationInch >= 0.05) {
    return 'Rainy';
  }
  if (weather.cloudCoverPercent >= 70) {
    return 'Cloudy';
  }
  return 'Clear';
}

export function formatSkyConditionLabel(condition: SkyCondition): string {
  const labels: Record<SkyCondition, string> = {
    Clear: 'Clear skies',
    Cloudy: 'Cloudy',
    Rainy: 'Rainy',
    Stormy: 'Stormy',
  };
  return labels[condition];
}

export function getActivityRatingColor(rating: ActivityRating): string {
  const colors: Record<ActivityRating, string> = {
    High: '#10B981',
    Moderate: '#F59E0B',
    Low: '#94A3B8',
  };
  return colors[rating];
}

export function scoreSpeciesActivity(
  species: AvailableSpecies,
  weather: WeatherSnapshot
): { rating: ActivityRating; score: number } {
  let score = 3;

  const tempC = ((weather.temperatureF - 32) * 5) / 9;
  if (species.idealTempMin != null && species.idealTempMax != null) {
    if (tempC >= species.idealTempMin && tempC <= species.idealTempMax) {
      score += 1;
    } else if (tempC < species.idealTempMin - 5 || tempC > species.idealTempMax + 5) {
      score -= 1;
    }
  }

  const sky = classifySkyCondition(weather);

  if (species.feedingZone === 'surface') {
    if (sky === 'Stormy') {
      score -= 2;
    } else if (sky === 'Rainy') {
      score -= 1;
    } else if (sky === 'Clear' && weather.windSpeedMph < 12) {
      score += 1;
    }
  }

  if (species.feedingZone === 'bottom' && (sky === 'Rainy' || sky === 'Cloudy')) {
    score += 1;
  }

  score = Math.max(1, Math.min(5, score));
  const rating: ActivityRating = score >= 4 ? 'High' : score >= 2 ? 'Moderate' : 'Low';
  return { rating, score };
}

export function buildSpeciesPredictions(
  species: AvailableSpecies[],
  weather: WeatherSnapshot | null | undefined
): SpeciesPredictionResult {
  if (!weather) {
    return {
      predictions: species.map((item) => ({
        ...item,
        activityRating: 'Moderate',
        score: 3,
        probability: 50,
        factors: [],
      })),
      skyCondition: null,
      temperatureF: null,
      spotContext: null,
      contextSubtitle: null,
    };
  }

  const skyCondition = classifySkyCondition(weather);
  const predictions = species
    .map((item) => {
      const { rating, score } = scoreSpeciesActivity(item, weather);
      const probability = score >= 4 ? 75 : score >= 2 ? 50 : 25;
      return {
        ...item,
        activityRating: rating,
        score,
        probability,
        factors: [],
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    predictions,
    skyCondition,
    temperatureF: weather.temperatureF,
    spotContext: null,
    contextSubtitle: null,
  };
}
