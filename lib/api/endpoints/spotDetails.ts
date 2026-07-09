import { resolvePostgisLocationUuid } from '@/lib/api/bundledLocationIds';
import { supabase } from '@/lib/supabase';
import type {
  CatchTimeSlot,
  SpotDetails,
  SpotDetailsRpcResponse,
  SpotDetailsSpeciesRow,
} from '@/lib/types/spotDetails';
import { formatCatchHourLabel } from '@/lib/types/spotDetails';

export function parsePostgisLocationId(spotId: string): string | null {
  return resolvePostgisLocationUuid(spotId);
}

function mapSpeciesRow(row: SpotDetailsSpeciesRow) {
  return {
    id: row.species_id,
    name: row.species_name,
    scientificName: row.scientific_name,
    primaryBiome: row.primary_biome,
    idealTempMin: row.ideal_temp_min,
    idealTempMax: row.ideal_temp_max,
    imageUrl: row.image_url,
    dataSource: row.data_source,
  };
}

function mapCatchTimes(
  rows: SpotDetailsRpcResponse['best_catch_times']
): CatchTimeSlot[] {
  return rows.map((row) => ({
    hour: row.hour,
    label: formatCatchHourLabel(row.hour),
    catchCount: Number(row.catch_count),
  }));
}

export async function fetchSpotDetails(
  latitude: number,
  longitude: number,
  spotId: string,
  signal?: AbortSignal
): Promise<SpotDetails> {
  const locationId = parsePostgisLocationId(spotId);

  const rpcCall = supabase.rpc('get_spot_details', {
    p_latitude: latitude,
    p_longitude: longitude,
    p_location_id: locationId,
  });

  if (signal) {
    signal.addEventListener('abort', () => void rpcCall, { once: true });
  }

  const { data, error } = await rpcCall;

  if (error) {
    if (
      error.code === 'PGRST202' ||
      error.message.includes('Could not find the function')
    ) {
      return { species: [], bestCatchTimes: [] };
    }
    throw new Error(error.message);
  }

  const payload = (data ?? {
    species: [],
    best_catch_times: [],
  }) as SpotDetailsRpcResponse;

  return {
    species: (payload.species ?? []).map(mapSpeciesRow),
    bestCatchTimes: mapCatchTimes(payload.best_catch_times ?? []),
  };
}
