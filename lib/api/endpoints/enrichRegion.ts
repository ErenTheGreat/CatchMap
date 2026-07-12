import { supabase } from '@/lib/supabase';
import { isCloudSyncEnabled } from '@/constants/features';

export interface EnrichedSpecies {
  id: string;
  name: string;
  scientificName: string;
  primaryBiome: string;
  dataSource: string;
}

export interface EnrichRegionResult {
  locationId: string | null;
  species: EnrichedSpecies[];
  cached: boolean;
  fetchedAt: string;
  tileCenter: { lat: number; lon: number };
}

export interface EnrichRegionParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  waterType?: 'saltwater' | 'freshwater' | 'brackish';
}

const TILE_GRID_DEGREES = 0.25;

/** Snap coordinates to the same 0.25° grid used by enrich-region. */
export function snapCoordsToTileGrid(lat: number, lon: number): { lat: number; lon: number } {
  const snap = (value: number) =>
    Math.round(value / TILE_GRID_DEGREES) * TILE_GRID_DEGREES;
  return { lat: snap(lat), lon: snap(lon) };
}

export function enrichRegionTileKey(lat: number, lon: number): string {
  const tile = snapCoordsToTileGrid(lat, lon);
  return `${tile.lat.toFixed(2)},${tile.lon.toFixed(2)}`;
}

export async function fetchEnrichRegion(
  params: EnrichRegionParams,
  signal?: AbortSignal
): Promise<EnrichRegionResult | null> {
  if (!isCloudSyncEnabled()) return null;

  const { data, error } = await supabase.functions.invoke('enrich-region', {
    body: {
      latitude: params.latitude,
      longitude: params.longitude,
      radiusKm: params.radiusKm ?? 50,
      waterType: params.waterType,
    },
  });

  if (signal?.aborted || error) {
    if (__DEV__) console.warn('[enrichRegion] failed:', error?.message ?? error);
    return null;
  }

  const payload = data as EnrichRegionResult & { error?: string };
  if (payload?.error) {
    if (__DEV__) console.warn('[enrichRegion] error:', payload.error);
    return null;
  }

  return payload;
}
