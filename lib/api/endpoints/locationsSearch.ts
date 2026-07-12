import { supabase } from '@/lib/supabase';
import type {
  LocationSearchResult,
  SearchFishingSpotsRow,
} from '@/lib/types/mapCoordinates';
import type { WaterType } from '@/lib/types/fishingEngine';
import type { NearbySpot } from '@/utils/osmFishingSpots';

const POSTGIS_SPOT_ID_PREFIX = 'postgis-';

const MIN_QUERY_LENGTH = 2;
const DEFAULT_LIMIT = 10;

/** EWKB point flag (PostGIS geography serialized as hex). */
const EWKB_SRID_FLAG = 0x20000000;

interface FishingSpotRow {
  id: string;
  name: string;
  water_type: string;
  latitude: number;
  longitude: number;
}

interface LocationTableRow {
  id: string;
  name: string;
  water_type: WaterType;
  coordinates?: string;
}

function mapWaterType(value: string): WaterType {
  const normalized = value.toLowerCase();
  if (normalized === 'saltwater' || normalized === 'coastal' || normalized === 'bay') {
    return 'saltwater';
  }
  if (normalized === 'brackish') {
    return 'brackish';
  }
  return 'freshwater';
}

/**
 * Decode a PostGIS EWKB point hex string (e.g. from geography columns) into WGS84
 * coordinates. Handles the common Supabase/PostgREST serialization format.
 */
function decodeGeographyPoint(value: unknown): { latitude: number; longitude: number } | null {
  if (typeof value !== 'string' || value.length < 42) {
    return null;
  }

  const hex = value.startsWith('\\x') ? value.slice(2) : value;
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }

  if (bytes.length < 21) {
    return null;
  }

  const littleEndian = bytes[0] === 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const readUInt32 = (offset: number) =>
    littleEndian ? view.getUint32(offset, true) : view.getUint32(offset, false);
  const readDouble = (offset: number) =>
    littleEndian ? view.getFloat64(offset, true) : view.getFloat64(offset, false);

  let offset = 1;
  const geometryType = readUInt32(offset);
  offset += 4;

  if (geometryType & EWKB_SRID_FLAG) {
    offset += 4;
  }

  const longitude = readDouble(offset);
  offset += 8;
  const latitude = readDouble(offset);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function extractCoordinates(row: Record<string, unknown>): { latitude: number; longitude: number } | null {
  const latitudeRaw = row.latitude ?? row.lat ?? row.y;
  const longitudeRaw = row.longitude ?? row.lng ?? row.lon ?? row.x;

  const latitude = Number(latitudeRaw);
  const longitude = Number(longitudeRaw);

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { latitude, longitude };
  }

  if (row.coordinates != null) {
    if (
      typeof row.coordinates === 'object' &&
      row.coordinates !== null &&
      'coordinates' in row.coordinates
    ) {
      const coords = (row.coordinates as { coordinates?: unknown }).coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        const geoLng = Number(coords[0]);
        const geoLat = Number(coords[1]);
        if (Number.isFinite(geoLat) && Number.isFinite(geoLng)) {
          return { latitude: geoLat, longitude: geoLng };
        }
      }
    }

    return decodeGeographyPoint(row.coordinates);
  }

  return null;
}

function normalizeRpcRow(row: Record<string, unknown>): SearchFishingSpotsRow | null {
  const id = typeof row.id === 'string' ? row.id : null;
  const name = typeof row.name === 'string' ? row.name : null;
  const waterTypeRaw = row.water_type ?? row.waterType;

  if (!id || !name) return null;

  const coords = extractCoordinates(row);
  if (!coords) return null;

  return {
    id,
    name,
    water_type: mapWaterType(String(waterTypeRaw ?? 'freshwater')),
    latitude: coords.latitude,
    longitude: coords.longitude,
  };
}

function toSearchResult(
  id: string,
  name: string,
  waterType: WaterType,
  latitude: number,
  longitude: number
): LocationSearchResult | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { id, name, waterType, latitude, longitude };
}

function mapRpcRow(row: SearchFishingSpotsRow): LocationSearchResult | null {
  return toSearchResult(
    row.id,
    row.name,
    row.water_type,
    Number(row.latitude),
    Number(row.longitude)
  );
}

async function searchViaRpc(searchTerm: string): Promise<LocationSearchResult[]> {
  const { data, error } = await supabase.rpc('search_fishing_spots', {
    search_term: searchTerm,
  });

  if (error) {
    if (
      error.code === 'PGRST202' ||
      error.message.includes('Could not find the function')
    ) {
      return [];
    }
    throw new Error(error.message);
  }

  if (!Array.isArray(data)) return [];

  return data
    .map((row) => {
      const normalized = normalizeRpcRow(row as Record<string, unknown>);
      return normalized ? mapRpcRow(normalized) : null;
    })
    .filter((row): row is LocationSearchResult => row != null);
}

async function searchViaLocationsTable(
  searchPattern: string
): Promise<LocationSearchResult[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, water_type, coordinates')
    .ilike('name', searchPattern)
    .order('name', { ascending: true })
    .limit(DEFAULT_LIMIT);

  if (error) {
    if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
      return [];
    }
    throw new Error(error.message);
  }

  return ((data ?? []) as LocationTableRow[])
    .map((row) => {
      const normalized = normalizeRpcRow(row as unknown as Record<string, unknown>);
      return normalized ? mapRpcRow(normalized) : null;
    })
    .filter((row): row is LocationSearchResult => row != null);
}

/** Fallback: legacy fishing_spots table (plain lat/lon columns, always deployed). */
async function searchViaFishingSpotsTable(
  searchPattern: string
): Promise<LocationSearchResult[]> {
  const { data, error } = await supabase
    .from('fishing_spots')
    .select('id, name, water_type, latitude, longitude')
    .ilike('name', searchPattern)
    .order('name', { ascending: true })
    .limit(DEFAULT_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as FishingSpotRow[])
    .map((row) =>
      toSearchResult(
        row.id,
        row.name,
        mapWaterType(row.water_type),
        Number(row.latitude),
        Number(row.longitude)
      )
    )
    .filter((row): row is LocationSearchResult => row != null);
}

export async function searchLocationsByName(
  query: string,
  signal?: AbortSignal
): Promise<LocationSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return [];
  }

  if (signal?.aborted) {
    return [];
  }

  const searchPattern = `%${trimmed}%`;
  const byId = new Map<string, LocationSearchResult>();

  const addResults = (rows: LocationSearchResult[]) => {
    for (const row of rows) {
      byId.set(row.id, row);
    }
  };

  addResults(await searchViaRpc(trimmed));

  if (byId.size === 0) {
    addResults(await searchViaLocationsTable(searchPattern));
  }

  if (byId.size === 0) {
    addResults(await searchViaFishingSpotsTable(searchPattern));
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** Build a map pin / bottom-sheet spot from a search selection. */
export function searchResultToNearbySpot(result: LocationSearchResult): NearbySpot {
  return {
    id: `${POSTGIS_SPOT_ID_PREFIX}${result.id}`,
    name: result.name,
    description: null,
    latitude: result.latitude,
    longitude: result.longitude,
    water_type: result.waterType,
    species: [],
    facilities: [],
    best_months: [],
    rating: 4.0,
    created_at: new Date().toISOString(),
    distance: 0,
    matchedSpecies: [],
    isPeakSeason: false,
  };
}

export { MIN_QUERY_LENGTH };
