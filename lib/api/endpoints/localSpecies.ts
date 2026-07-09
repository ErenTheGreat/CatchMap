import { supabase } from '@/lib/supabase';
import type { LocalSpecies, SpeciesNearPointRow } from '@/lib/types/fishingEngine';

const DEFAULT_RADIUS_METERS = 5000;

function mapRow(row: SpeciesNearPointRow): LocalSpecies {
  return {
    id: row.species_id,
    name: row.species_name,
    scientificName: row.scientific_name,
    primaryBiome: row.primary_biome,
    idealTempMin: row.ideal_temp_min,
    idealTempMax: row.ideal_temp_max,
    imageUrl: row.image_url,
    waterType: row.water_type,
    distanceMeters: row.distance_meters,
    dataSource: row.data_source,
    locationName: row.location_name,
  };
}

/** Dedupe by species id — keep the closest documented location. */
function dedupeSpecies(rows: SpeciesNearPointRow[]): LocalSpecies[] {
  const byId = new Map<string, LocalSpecies>();

  for (const row of rows) {
    const mapped = mapRow(row);
    const existing = byId.get(mapped.id);
    if (!existing || mapped.distanceMeters < existing.distanceMeters) {
      byId.set(mapped.id, mapped);
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export async function fetchLocalSpeciesNearPoint(
  latitude: number,
  longitude: number,
  radiusMeters: number = DEFAULT_RADIUS_METERS,
  signal?: AbortSignal
): Promise<LocalSpecies[]> {
  const rpcCall = supabase.rpc('get_species_near_point', {
    p_latitude: latitude,
    p_longitude: longitude,
    p_radius_meters: radiusMeters,
  });

  if (signal) {
    signal.addEventListener(
      'abort',
      () => {
        void rpcCall;
      },
      { once: true }
    );
  }

  const { data, error } = await rpcCall;

  if (error) {
    throw new Error(error.message);
  }

  if (!data || !Array.isArray(data)) {
    return [];
  }

  return dedupeSpecies(data as SpeciesNearPointRow[]);
}

export { DEFAULT_RADIUS_METERS };
