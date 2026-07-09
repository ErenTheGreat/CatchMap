import { supabase } from '@/lib/supabase';
import { resolvePostgisLocationUuid } from '@/lib/api/bundledLocationIds';
import {
  fetchBundledSpeciesAvailabilityWithContext,
  findBundledSpot,
} from '@/lib/api/endpoints/bundledSpeciesAvailability';
import { fetchCatalogSpeciesPresenceNearPoint } from '@/lib/species/gbifCatalogPresence';
import { getCachedPresenceNearPoint } from '@/lib/species/gbifPresenceCache';
import { matchGbifOccurrences, buildGbifSpeciesList } from '@/lib/species/matchGbifToCatalog';
import { spotLikelyNeedsGbifLookup } from '@/lib/species/spotGbifLookup';
import type {
  AvailableSpecies,
  CatchActivityRow,
  DataConfidence,
  SpeciesAvailabilityResult,
  SpeciesAvailabilityRow,
  SpeciesSource,
  SpotContext,
} from '@/lib/types/speciesPrediction';
import type { SpeciesNearPointRow } from '@/lib/types/fishingEngine';

function toNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const VERIFIED_SPECIES_SOURCES = new Set<SpeciesSource>([
  'location',
  'bundled',
  'presence',
  'gbif',
  'gbif_discovered',
]);

export function isVerifiedSpeciesSource(source?: SpeciesSource): boolean {
  return source != null && VERIFIED_SPECIES_SOURCES.has(source);
}

export function filterVerifiedAvailabilityRows(
  rows: SpeciesAvailabilityRow[]
): SpeciesAvailabilityRow[] {
  return rows.filter((row) => isVerifiedSpeciesSource(row.source ?? 'presence'));
}

function emptySpeciesResult(): SpeciesAvailabilityResult {
  return { species: [], spotContext: null };
}

function confidenceForSource(source?: SpeciesSource): DataConfidence {
  switch (source) {
    case 'location':
    case 'bundled':
      return 'high';
    case 'gbif':
    case 'presence':
      return 'medium';
    case 'gbif_discovered':
    case 'category':
    default:
      return 'low';
  }
}

function normalizeAvailabilityRow(raw: unknown): SpeciesAvailabilityRow | null {
  if (!raw || typeof raw !== 'object') return null;

  const row = raw as Record<string, unknown>;
  const speciesId = row.species_id ?? row.id;
  const speciesName = row.species_name ?? row.name;
  if (speciesId == null || speciesName == null) {
    return null;
  }

  const feedingZone = row.feeding_zone ?? row.feedingZone;
  const monthStart = row.month_start ?? row.monthStart;
  const monthEnd = row.month_end ?? row.monthEnd;

  return {
    species_id: String(speciesId),
    species_name: String(speciesName),
    scientific_name: String(row.scientific_name ?? row.scientificName ?? ''),
    image_url: (row.image_url ?? row.imageUrl ?? null) as string | null,
    feeding_zone: (feedingZone === 'surface' || feedingZone === 'mid' || feedingZone === 'bottom'
      ? feedingZone
      : 'mid') as SpeciesAvailabilityRow['feeding_zone'],
    ideal_temp_min: toNumberOrNull(row.ideal_temp_min ?? row.idealTempMin),
    ideal_temp_max: toNumberOrNull(row.ideal_temp_max ?? row.idealTempMax),
    month_start: Number(monthStart ?? 1),
    month_end: Number(monthEnd ?? 12),
    source: row.source as SpeciesAvailabilityRow['source'],
  };
}

function mapAvailabilityRow(row: SpeciesAvailabilityRow): AvailableSpecies {
  const source = row.source ?? 'presence';
  return {
    id: row.species_id,
    name: row.species_name,
    scientificName: row.scientific_name,
    imageUrl: row.image_url,
    feedingZone: row.feeding_zone ?? 'mid',
    idealTempMin: toNumberOrNull(row.ideal_temp_min),
    idealTempMax: toNumberOrNull(row.ideal_temp_max),
    monthStart: Number(row.month_start),
    monthEnd: Number(row.month_end),
    source,
    dataConfidence: confidenceForSource(source),
  };
}

/** Collapse duplicate species rows that share an id or display name. */
export function dedupeAvailableSpecies(species: AvailableSpecies[]): AvailableSpecies[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const deduped: AvailableSpecies[] = [];

  for (const item of species) {
    const nameKey = item.name.trim().toLowerCase();
    if (!nameKey || seenIds.has(item.id) || seenNames.has(nameKey)) {
      continue;
    }
    seenIds.add(item.id);
    seenNames.add(nameKey);
    deduped.push(item);
  }

  return deduped;
}

/** RPC returns jsonb — a JSON array of row objects (see migration 010). */
function parseSpeciesAvailabilityRows(data: unknown): SpeciesAvailabilityRow[] {
  let payload = data;

  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload) as unknown;
    } catch {
      return [];
    }
  }

  const candidates: unknown[] = [];
  if (Array.isArray(payload)) {
    candidates.push(...payload);
  } else if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { species?: unknown }).species)
  ) {
    candidates.push(...(payload as { species: unknown[] }).species);
  }

  return candidates
    .map(normalizeAvailabilityRow)
    .filter((row): row is SpeciesAvailabilityRow => row != null);
}

async function rpcGetSpeciesAvailabilityForLocation(
  locationId: string,
  month: number,
  signal?: AbortSignal
): Promise<SpeciesAvailabilityRow[] | null> {
  const rpcCall = supabase.rpc('get_species_availability_for_location', {
    p_location_id: locationId,
    p_month: month,
  });

  if (signal) {
    signal.addEventListener('abort', () => void rpcCall, { once: true });
  }

  const { data, error } = await rpcCall;
  if (error) {
    if (
      error.code === 'PGRST202' ||
      error.code === 'PGRST203' ||
      error.message.includes('Could not find the function') ||
      error.message.includes('Could not choose the best candidate function')
    ) {
      return null;
    }

    throw new Error(error.message);
  }

  return parseSpeciesAvailabilityRows(data);
}

function mapNearPointRow(row: SpeciesNearPointRow): AvailableSpecies {
  const source: SpeciesSource =
    row.data_source === 'GBIF' ? 'gbif' : 'presence';
  return {
    id: row.species_id,
    name: row.species_name,
    scientificName: row.scientific_name,
    imageUrl: row.image_url,
    feedingZone: 'mid',
    idealTempMin: row.ideal_temp_min,
    idealTempMax: row.ideal_temp_max,
    monthStart: 1,
    monthEnd: 12,
    source,
    dataConfidence: confidenceForSource(source),
  };
}

async function fetchNearPointFallback(
  latitude: number | null,
  longitude: number | null,
  signal?: AbortSignal
): Promise<AvailableSpecies[]> {
  if (latitude == null || longitude == null) {
    return [];
  }

  const rpcCall = supabase.rpc('get_species_near_point', {
    p_latitude: latitude,
    p_longitude: longitude,
    p_radius_meters: 500,
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
      return [];
    }
    throw new Error(error.message);
  }

  if (!data || !Array.isArray(data)) {
    return [];
  }

  const byId = new Map<string, AvailableSpecies>();
  for (const row of data as SpeciesNearPointRow[]) {
    const mapped = mapNearPointRow(row);
    if (!byId.has(mapped.id)) {
      byId.set(mapped.id, mapped);
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

const LAKE_NAME_PATTERN = /lake|pond|reservoir/i;
const CREEK_RADIUS_KM = 5;
const LAKE_RADIUS_KM = 8;
const MAX_GBIF_RADIUS_KM = 25;

export function getGbifSearchRadiusKm(spotName?: string | null): number {
  if (spotName && LAKE_NAME_PATTERN.test(spotName)) {
    return LAKE_RADIUS_KM;
  }
  return CREEK_RADIUS_KM;
}

function gbifSearchRadii(spotName?: string | null): number[] {
  const base = getGbifSearchRadiusKm(spotName);
  return [...new Set([base, Math.min(base * 2, MAX_GBIF_RADIUS_KM), MAX_GBIF_RADIUS_KM])].sort(
    (a, b) => a - b
  );
}

async function fetchGbifSpeciesForSpot(
  latitude: number,
  longitude: number,
  month: number,
  spotName?: string | null,
  signal?: AbortSignal
): Promise<AvailableSpecies[]> {
  for (const radiusKm of gbifSearchRadii(spotName)) {
    try {
      const occurrences = await fetchCatalogSpeciesPresenceNearPoint(
        latitude,
        longitude,
        radiusKm,
        signal
      );
      const species = buildGbifSpeciesList(matchGbifOccurrences(occurrences, month));
      if (species.length > 0) {
        return species;
      }
    } catch {
      // try wider radius
    }
  }

  return [];
}

function freshwaterSpotContext(): SpotContext {
  return {
    waterType: 'Freshwater',
    avgDepthFeet: 20,
    underwaterStructure: [],
    bestSeason: '',
    isSaltwater: false,
  };
}

export async function fetchCatchActivityNearPoint(
  latitude: number,
  longitude: number,
  radiusMeters: number = 500,
  daysBack: number = 90,
  signal?: AbortSignal
): Promise<CatchActivityRow[]> {
  const rpcCall = supabase.rpc('get_catch_activity_near_point', {
    p_latitude: latitude,
    p_longitude: longitude,
    p_radius_meters: radiusMeters,
    p_days_back: daysBack,
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
      return [];
    }
    throw new Error(error.message);
  }

  if (!data || !Array.isArray(data)) {
    return [];
  }

  return (data as Array<Record<string, unknown>>).map((row) => ({
    speciesId: String(row.species_id ?? ''),
    speciesName: String(row.species_name ?? ''),
    catchCount: Number(row.catch_count ?? 0),
    topLures: Array.isArray(row.top_lures) ? (row.top_lures as string[]) : [],
  }));
}

async function fetchSpeciesAvailabilityOffline(
  locationId: string | null,
  latitude: number | null,
  longitude: number | null,
  month: number,
  spotName?: string | null
): Promise<SpeciesAvailabilityResult> {
  const bundledSpot = findBundledSpot(locationId);
  if (bundledSpot) {
    return fetchBundledSpeciesAvailabilityWithContext(locationId, month);
  }

  if (latitude != null && longitude != null) {
    for (const radiusKm of gbifSearchRadii(spotName)) {
      const cached = await getCachedPresenceNearPoint(latitude, longitude, radiusKm);
      if (cached === undefined || cached.length === 0) continue;

      const species = buildGbifSpeciesList(matchGbifOccurrences(cached, month));
      if (species.length > 0) {
        return { species: dedupeAvailableSpecies(species), spotContext: freshwaterSpotContext() };
      }
    }

    const nearPoint = await fetchNearPointFallback(latitude, longitude);
    if (nearPoint.length > 0) {
      return { species: dedupeAvailableSpecies(nearPoint), spotContext: null };
    }
  }

  return emptySpeciesResult();
}

export async function fetchSpeciesAvailabilityWithContext(
  locationId: string | null,
  latitude: number | null,
  longitude: number | null,
  month: number = new Date().getMonth() + 1,
  signal?: AbortSignal,
  spotName?: string | null,
  waterType?: string | null,
  offlineMode: boolean = false
): Promise<SpeciesAvailabilityResult> {
  if (offlineMode) {
    return fetchSpeciesAvailabilityOffline(
      locationId,
      latitude,
      longitude,
      month,
      spotName
    );
  }

  const parsedLocationId = resolvePostgisLocationUuid(locationId);
  const bundledSpot = findBundledSpot(locationId);

  if (bundledSpot) {
    return fetchBundledSpeciesAvailabilityWithContext(locationId, month);
  }

  if (parsedLocationId) {
    const gbifPromise =
      latitude != null &&
      longitude != null &&
      spotLikelyNeedsGbifLookup(locationId)
        ? fetchGbifSpeciesForSpot(latitude, longitude, month, spotName, signal)
        : null;

    const rows = await rpcGetSpeciesAvailabilityForLocation(parsedLocationId, month, signal);
    const verifiedRows = filterVerifiedAvailabilityRows(rows ?? []);

    if (verifiedRows.length > 0) {
      const spotContext =
        latitude != null && longitude != null
          ? inferSpotContextFromSpecies(verifiedRows, latitude, longitude)
          : null;
      return {
        species: dedupeAvailableSpecies(verifiedRows.map(mapAvailabilityRow)),
        spotContext,
      };
    }

    if (latitude != null && longitude != null) {
      const gbifSpecies = gbifPromise
        ? await gbifPromise
        : await fetchGbifSpeciesForSpot(latitude, longitude, month, spotName, signal);
      if (gbifSpecies.length > 0) {
        return { species: dedupeAvailableSpecies(gbifSpecies), spotContext: freshwaterSpotContext() };
      }
    }

    const nearPoint = await fetchNearPointFallback(latitude, longitude, signal);
    if (nearPoint.length > 0) {
      return { species: dedupeAvailableSpecies(nearPoint), spotContext: null };
    }

    return emptySpeciesResult();
  }

  const nearPoint = await fetchNearPointFallback(latitude, longitude, signal);
  if (nearPoint.length > 0) {
    return { species: nearPoint, spotContext: null };
  }

  return emptySpeciesResult();
}

function inferSpotContextFromSpecies(
  rows: SpeciesAvailabilityRow[],
  latitude: number,
  longitude: number
): SpotContext | null {
  const hasSaltwater = rows.some((row) =>
    /halibut|shark|ray|striped bass/i.test(row.species_name)
  );
  return {
    waterType: hasSaltwater ? 'Saltwater' : 'Freshwater',
    avgDepthFeet: 20,
    underwaterStructure: [],
    bestSeason: '',
    isSaltwater: hasSaltwater,
  };
}

/** @deprecated Use fetchSpeciesAvailabilityWithContext for spot metadata. */
export async function fetchSpeciesAvailability(
  locationId: string | null,
  latitude: number | null,
  longitude: number | null,
  month: number = new Date().getMonth() + 1,
  signal?: AbortSignal,
  spotName?: string | null,
  waterType?: string | null,
  offlineMode: boolean = false
): Promise<AvailableSpecies[]> {
  const result = await fetchSpeciesAvailabilityWithContext(
    locationId,
    latitude,
    longitude,
    month,
    signal,
    spotName,
    waterType,
    offlineMode
  );
  return result.species;
}
