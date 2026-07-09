import type { PrimaryBiome, SpeciesDataSource } from '@/lib/types/fishingEngine';

export interface SpotSpecies {
  id: string;
  name: string;
  scientificName: string;
  primaryBiome: PrimaryBiome;
  idealTempMin: number | null;
  idealTempMax: number | null;
  imageUrl: string | null;
  dataSource: SpeciesDataSource;
}

export interface CatchTimeSlot {
  hour: number;
  label: string;
  catchCount: number;
}

export interface SpotDetails {
  species: SpotSpecies[];
  bestCatchTimes: CatchTimeSlot[];
}

/** Raw species row inside get_spot_details JSON response. */
export interface SpotDetailsSpeciesRow {
  species_id: string;
  species_name: string;
  scientific_name: string;
  primary_biome: PrimaryBiome;
  ideal_temp_min: number | null;
  ideal_temp_max: number | null;
  image_url: string | null;
  data_source: SpeciesDataSource;
}

/** Raw catch time row inside get_spot_details JSON response. */
export interface SpotDetailsCatchTimeRow {
  hour: number;
  catch_count: number;
}

export interface SpotDetailsRpcResponse {
  species: SpotDetailsSpeciesRow[];
  best_catch_times: SpotDetailsCatchTimeRow[];
}

export function formatCatchHourLabel(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  if (normalized === 0) return '12 AM';
  if (normalized === 12) return '12 PM';
  if (normalized < 12) return `${normalized} AM`;
  return `${normalized - 12} PM`;
}
