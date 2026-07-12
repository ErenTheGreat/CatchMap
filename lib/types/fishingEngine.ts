export type PrimaryBiome =
  | 'freshwater_lake'
  | 'freshwater_river'
  | 'coastal_saltwater'
  | 'tropical_estuary'
  | 'brackish_bay'
  | 'unknown';

export type WaterType = 'saltwater' | 'freshwater' | 'brackish';

export type SpeciesDataSource = 'API' | 'User' | 'GBIF' | 'FishBase' | 'Manual';

/** Raw row shape returned by the `get_species_near_point` RPC. */
export interface SpeciesNearPointRow {
  species_id: string;
  species_name: string;
  scientific_name: string;
  primary_biome: PrimaryBiome;
  ideal_temp_min: number | null;
  ideal_temp_max: number | null;
  image_url: string | null;
  location_id: string;
  location_name: string;
  water_type: WaterType;
  distance_meters: number;
  data_source: SpeciesDataSource;
}

/** Normalized species record for UI consumption. */
export interface LocalSpecies {
  id: string;
  name: string;
  scientificName: string;
  primaryBiome: PrimaryBiome;
  idealTempMin: number | null;
  idealTempMax: number | null;
  imageUrl: string | null;
  waterType: WaterType;
  distanceMeters: number;
  dataSource: SpeciesDataSource;
  locationName: string;
}

export function formatBiomeLabel(biome: PrimaryBiome): string {
  return biome
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatWaterTypeLabel(waterType: WaterType): string {
  return waterType.charAt(0).toUpperCase() + waterType.slice(1);
}

export function formatIdealTempRange(
  min: number | null,
  max: number | null
): string {
  if (min != null && max != null) {
    return `${min}°C – ${max}°C`;
  }
  if (min != null) return `≥ ${min}°C`;
  if (max != null) return `≤ ${max}°C`;
  return 'Not recorded';
}

export function formatDistanceMeters(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}
