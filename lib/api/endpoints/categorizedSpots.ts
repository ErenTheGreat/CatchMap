import { supabase } from '@/lib/supabase';
import { bundledSpotIdToLocationUuid } from '@/lib/api/bundledLocationIds';
import fishingData from '@/data/FishingDatabase';
import type {
  CategorizedSpotCategory,
  CategorizedSpotRow,
  CategorizedSpotsResponse,
} from '@/lib/types/categorizedSpots';
import type { BBox } from '@/lib/api/endpoints/spatialSpots';
import { bboxToRpcParams } from '@/lib/api/endpoints/spatialSpots';
import { calculateDistance } from '@/utils/geo';
import { enrichNearbySpotFromLocation } from '@/utils/spotMetadata';
import {
  auditBBoxAgainstReference,
  bboxContainsPoint,
  bboxToLogCoords,
  REFERENCE_LOCATION,
} from '@/lib/mapViewport';
import type { NearbySpot } from '@/utils/osmFishingSpots';
import {
  MIN_DISCOVERY_SPOTS,
  sparseExpansionBboxes,
} from '@/lib/discovery/sparseRegionExpand';

const POSTGIS_SPOT_ID_PREFIX = 'postgis-';

/** Reject discovery fetches when the visible region spans more than this (degrees). */
export const MAX_DISCOVERY_BBOX_SPAN_DEGREES = 10;

const DEFAULT_CATEGORY_ORDER = ['Lake', 'Creek', 'Bay', 'Other'] as const;

/** Normalize RPC/dashboard category labels to short app names. */
export function normalizeDiscoveryCategory(category: string): string {
  switch (category) {
    case 'Lakes & Ponds':
      return 'Lake';
    case 'Rivers & Creeks':
      return 'Creek';
    case 'Bays & Oceans':
      return 'Bay';
    default:
      return category;
  }
}

export function isDiscoveryBBoxTooLarge(bbox: BBox): boolean {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  return (
    latSpan > MAX_DISCOVERY_BBOX_SPAN_DEGREES ||
    lngSpan > MAX_DISCOVERY_BBOX_SPAN_DEGREES
  );
}

export function bboxCenter(bbox: BBox): { lat: number; lng: number } {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  };
}

/** Map internal [minLng, minLat, maxLng, maxLat] → Supabase RPC parameter names. */
export function bboxToCategorizedRpcParams(bbox: BBox) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return {
    p_min_lat: minLat,
    p_max_lat: maxLat,
    p_min_lng: minLng,
    p_max_lng: maxLng,
  };
}

function auditRpcParams(bbox: BBox, rpcParams: ReturnType<typeof bboxToCategorizedRpcParams>) {
  const paramIssues = Object.entries(rpcParams)
    .filter(([, value]) => value == null || !Number.isFinite(value))
    .map(([key, value]) => `${key}=${String(value)}`);

  const containsReference = bboxContainsPoint(
    bbox,
    REFERENCE_LOCATION.lat,
    REFERENCE_LOCATION.lng
  );

  if (__DEV__) {
    console.log('RPC params (exact):', rpcParams);
    console.log('[categorizedSpots] RPC param audit:', {
      ...auditBBoxAgainstReference(bbox),
      invalidParams: paramIssues.length > 0 ? paramIssues : 'none',
      referenceShouldMatchIfMapCenteredOnEastBay: containsReference,
      note: 'Shadow Cliffs is at lat 37.669352, lng -121.841891 — referenceInsideBBox should be true when viewing East Bay',
    });
  }
}

function coerceJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function isRpcNotFound(error: { code?: string; message?: string }): boolean {
  return (
    error.code === 'PGRST202' ||
    Boolean(error.message?.includes('Could not find the function'))
  );
}

function inferCategory(name: string, waterType: string, storedCategory?: string | null): string {
  if (storedCategory && DEFAULT_CATEGORY_ORDER.includes(storedCategory as (typeof DEFAULT_CATEGORY_ORDER)[number])) {
    return storedCategory;
  }

  const lower = name.toLowerCase();
  if (
    waterType === 'saltwater' ||
    /bay|ocean|harbor|harbour|beach|coast|sound/.test(lower)
  ) {
    return 'Bay';
  }
  if (/river|creek|stream|run/.test(lower)) {
    return 'Creek';
  }
  if (/lake|pond|reservoir/.test(lower)) {
    return 'Lake';
  }
  return 'Other';
}

interface FlatSpotInput {
  id: string;
  name: string;
  water_type: string;
  latitude: number;
  longitude: number;
}

function buildCategoriesFromFlatSpots(
  rows: FlatSpotInput[],
  bbox: BBox
): CategorizedSpotsResponse {
  const { lat: centerLat, lng: centerLng } = bboxCenter(bbox);
  const byCategory = new Map<string, CategorizedSpotRow[]>();

  for (const row of rows) {
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const category = inferCategory(row.name, row.water_type ?? 'freshwater');
    const spotRow: CategorizedSpotRow = {
      id: String(row.id),
      name: row.name,
      water_type: row.water_type ?? 'freshwater',
      latitude,
      longitude,
      distance_miles: 0,
    };

    const list = byCategory.get(category) ?? [];
    list.push(spotRow);
    byCategory.set(category, list);
  }

  const groups = Array.from(byCategory.entries()).map(([category, spots]) => ({
    category,
    spots,
  }));

  return sortCategories(
    groups
      .map((group) => mapCategoryGroup(group, centerLat, centerLng))
      .filter((group) => group.spots.length > 0)
  );
}

async function fetchViaLocationsInBBox(
  bbox: BBox,
  signal?: AbortSignal
): Promise<CategorizedSpotsResponse | null> {
  const rpcCall = supabase.rpc('get_locations_in_bbox', bboxToRpcParams(bbox));

  if (signal) {
    signal.addEventListener('abort', () => void rpcCall, { once: true });
  }

  const { data, error } = await rpcCall;
  if (error) {
    if (isRpcNotFound(error)) return null;
    throw new Error(error.message);
  }

  const rows = (data ?? []) as FlatSpotInput[];
  if (__DEV__) {
    console.log('[categorizedSpots] Fallback get_locations_in_bbox returned', rows.length, 'rows');
  }
  return buildCategoriesFromFlatSpots(rows, bbox);
}

async function fetchViaFishingSpotsTable(
  bbox: BBox,
  signal?: AbortSignal
): Promise<CategorizedSpotsResponse> {
  const [minLng, minLat, maxLng, maxLat] = bbox;

  let query = supabase
    .from('fishing_spots')
    .select('id, name, water_type, latitude, longitude')
    .gte('latitude', minLat)
    .lte('latitude', maxLat)
    .gte('longitude', minLng)
    .lte('longitude', maxLng)
    .limit(100);

  if (signal) {
    signal.addEventListener('abort', () => void query, { once: true });
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as FlatSpotInput[];
  if (__DEV__) {
    console.log('[categorizedSpots] Fallback fishing_spots table returned', rows.length, 'rows');
  }
  return buildCategoriesFromFlatSpots(rows, bbox);
}

function bundledWaterType(waterType: string): string {
  const lower = waterType.toLowerCase();
  if (
    lower.includes('salt') ||
    lower.includes('bay') ||
    lower.includes('coastal') ||
    lower.includes('ocean')
  ) {
    return 'saltwater';
  }
  return 'freshwater';
}

/** Offline-safe Bay Area dataset — matches migration 007 seed rows. */
function fetchBundledSpotsInBBox(bbox: BBox): CategorizedSpotsResponse {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const rows: FlatSpotInput[] = fishingData
    .filter(
      (spot) =>
        spot.latitude >= minLat &&
        spot.latitude <= maxLat &&
        spot.longitude >= minLng &&
        spot.longitude <= maxLng
    )
    .map((spot) => ({
      id: bundledSpotIdToLocationUuid(spot.id) ?? spot.id,
      name: spot.name,
      water_type: bundledWaterType(spot.waterType),
      latitude: spot.latitude,
      longitude: spot.longitude,
    }));

  if (__DEV__) {
    console.log('[categorizedSpots] Bundled dataset returned', rows.length, 'rows');
  }
  return buildCategoriesFromFlatSpots(rows, bbox);
}

function mergeCategorizedResponses(
  responses: CategorizedSpotsResponse[],
  _viewportBBox: BBox
): CategorizedSpotsResponse {
  const byId = new Map<string, NearbySpot>();
  const categoryById = new Map<string, string>();

  for (const response of responses) {
    for (const group of response) {
      for (const spot of group.spots) {
        if (!byId.has(spot.id)) {
          byId.set(spot.id, spot);
          categoryById.set(spot.id, group.category ?? 'Other');
        }
      }
    }
  }

  const sorted = Array.from(byId.values()).sort(
    (a, b) => (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER)
  );

  const byCategory = new Map<string, NearbySpot[]>();
  for (const spot of sorted) {
    const category = categoryById.get(spot.id) ?? 'Other';
    const list = byCategory.get(category) ?? [];
    list.push(spot);
    byCategory.set(category, list);
  }

  return sortCategories(
    Array.from(byCategory.entries()).map(([category, spots]) => ({ category, spots }))
  );
}

async function enrichSparseDiscoveryResult(
  bbox: BBox,
  primary: CategorizedSpotsResponse,
  signal?: AbortSignal
): Promise<CategorizedSpotsResponse> {
  let best = primary;
  let bestCount = countCategorizedSpots(primary);
  if (bestCount >= MIN_DISCOVERY_SPOTS) {
    return best;
  }

  for (const expanded of sparseExpansionBboxes(bbox)) {
    const expandedRows = await fetchViaLocationsInBBox(expanded, signal);
    if (!expandedRows || countCategorizedSpots(expandedRows) === 0) {
      continue;
    }

    const merged = mergeCategorizedResponses([best, expandedRows], bbox);
    const mergedCount = countCategorizedSpots(merged);
    if (mergedCount > bestCount) {
      best = merged;
      bestCount = mergedCount;
      if (__DEV__) {
        console.log(
          `[categorizedSpots] Sparse-region expansion: ${mergedCount} spots in widened search`
        );
      }
    }
    if (bestCount >= MIN_DISCOVERY_SPOTS) {
      break;
    }
  }

  return best;
}

async function fetchCategorizedSpotsFallback(
  bbox: BBox,
  signal?: AbortSignal
): Promise<CategorizedSpotsResponse> {
  const fromLocations = await fetchViaLocationsInBBox(bbox, signal);
  if (fromLocations && fromLocations.length > 0) {
    return fromLocations;
  }

  const fromTable = await fetchViaFishingSpotsTable(bbox, signal);
  if (countCategorizedSpots(fromTable) > 0) {
    return fromTable;
  }

  return fetchBundledSpotsInBBox(bbox);
}

function mapSpotRow(
  row: CategorizedSpotRow,
  centerLat: number,
  centerLng: number,
  category?: string | null
): NearbySpot | null {
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const distanceMiles = Number(row.distance_miles);
  const distance = Number.isFinite(distanceMiles) && distanceMiles > 0
    ? Math.round(distanceMiles * 10) / 10
    : Math.round(
        calculateDistance(centerLat, centerLng, latitude, longitude) * 10
      ) / 10;

  const rawId = String(row.id).replace(/^postgis-/, '');

  return enrichNearbySpotFromLocation(
    {
      id: `${POSTGIS_SPOT_ID_PREFIX}${rawId}`,
      name: row.name,
      description: null,
      latitude,
      longitude,
      water_type: row.water_type ?? 'freshwater',
      species: [],
      facilities: [],
      best_months: [],
      rating: 4.0,
      created_at: new Date().toISOString(),
      distance,
      matchedSpecies: [],
      isPeakSeason: false,
    },
    { category }
  );
}

function normalizeSpotRow(raw: Record<string, unknown>): CategorizedSpotRow | null {
  const idRaw = raw.id ?? raw.location_id ?? raw.locationId;
  const id = idRaw != null ? String(idRaw).trim() : '';
  const nameRaw = raw.name ?? raw.location_name ?? raw.locationName;
  const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';

  if (!id || !name) {
    if (__DEV__) console.warn('[categorizedSpots] Dropping spot row (missing id/name):', raw);
    return null;
  }

  const latitude = Number(raw.latitude ?? raw.lat ?? raw.y);
  const longitude = Number(raw.longitude ?? raw.lng ?? raw.lon ?? raw.x);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    if (__DEV__) console.warn('[categorizedSpots] Dropping spot row (invalid coords):', raw);
    return null;
  }

  const distanceRaw = raw.distance_miles ?? raw.distanceMiles ?? raw.distance ?? 0;

  return {
    id,
    name,
    water_type: String(raw.water_type ?? raw.waterType ?? 'freshwater'),
    latitude,
    longitude,
    distance_miles: Number(distanceRaw),
  };
}

function normalizeCategoryGroup(
  raw: unknown
): { category: string; spots: CategorizedSpotRow[] } | null {
  if (!raw || typeof raw !== 'object') return null;

  const record = raw as Record<string, unknown>;
  const category =
    typeof record.category === 'string'
      ? record.category
      : typeof record.category_name === 'string'
        ? record.category_name
        : null;

  const spotsRaw = record.spots ?? record.locations ?? record.items;
  if (!category) return null;

  const spots = coerceJsonArray(spotsRaw)
    .map((spot) => normalizeSpotRow(spot as Record<string, unknown>))
    .filter((spot): spot is CategorizedSpotRow => spot != null);

  return { category, spots };
}

function mapCategoryGroup(
  group: { category: string; spots: CategorizedSpotRow[] },
  centerLat: number,
  centerLng: number
): CategorizedSpotCategory {
  return {
    category: normalizeDiscoveryCategory(group.category),
    spots: group.spots
      .map((row) => mapSpotRow(row, centerLat, centerLng, group.category))
      .filter((spot): spot is NearbySpot => spot != null)
      .sort((a, b) => a.distance - b.distance),
  };
}

function sortCategories(categories: CategorizedSpotCategory[]): CategorizedSpotCategory[] {
  const orderIndex = new Map(DEFAULT_CATEGORY_ORDER.map((name, index) => [name, index]));

  return [...categories].sort((a, b) => {
    const aIndex = orderIndex.get(a.category as (typeof DEFAULT_CATEGORY_ORDER)[number]);
    const bIndex = orderIndex.get(b.category as (typeof DEFAULT_CATEGORY_ORDER)[number]);
    if (aIndex != null && bIndex != null) return aIndex - bIndex;
    if (aIndex != null) return -1;
    if (bIndex != null) return 1;
    return a.category.localeCompare(b.category);
  });
}

function unwrapRpcPayload(data: unknown): unknown {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.categories)) return record.categories;
    if (Array.isArray(record.data)) return record.data;
  }

  return data;
}

function parseRpcPayload(data: unknown, bbox: BBox): CategorizedSpotsResponse {
  const unwrapped = unwrapRpcPayload(data);

  if (__DEV__) {
    console.log('[categorizedSpots] RPC raw response type:', typeof unwrapped, {
      isArray: Array.isArray(unwrapped),
      length: Array.isArray(unwrapped) ? unwrapped.length : undefined,
      sample: Array.isArray(unwrapped) ? unwrapped[0] : unwrapped,
    });
  }

  if (!unwrapped) return [];

  const { lat: centerLat, lng: centerLng } = bboxCenter(bbox);
  let groups: Array<{ category: string; spots: CategorizedSpotRow[] }> = [];

  if (Array.isArray(unwrapped)) {
    groups = unwrapped
      .map((item) => normalizeCategoryGroup(item))
      .filter((group): group is { category: string; spots: CategorizedSpotRow[] } => group != null);
  } else if (typeof unwrapped === 'object') {
    groups = Object.entries(unwrapped as Record<string, unknown>)
      .filter(([, value]) => coerceJsonArray(value).length > 0 || Array.isArray(value))
      .map(([category, spotsRaw]) => ({
        category,
        spots: coerceJsonArray(spotsRaw)
          .map((spot) => normalizeSpotRow(spot as Record<string, unknown>))
          .filter((spot): spot is CategorizedSpotRow => spot != null),
      }));
  }

  const result = sortCategories(
    groups
      .map((group) => mapCategoryGroup(group, centerLat, centerLng))
      .filter((group) => group.spots.length > 0)
  );

  const totalSpots = result.reduce((sum, group) => sum + group.spots.length, 0);
  if (__DEV__) {
    console.log('[categorizedSpots] Parsed result:', {
      categoryCount: result.length,
      totalSpots,
      categories: result.map((group) => ({
        name: group.category,
        spots: group.spots.length,
      })),
    });
  }

  return result;
}

export async function fetchCategorizedSpotsInBBox(
  bbox: BBox,
  signal?: AbortSignal
): Promise<CategorizedSpotsResponse> {
  if (isDiscoveryBBoxTooLarge(bbox)) {
    if (__DEV__) {
      console.log('[categorizedSpots] BBox too large — skipping RPC:', bboxToLogCoords(bbox));
    }
    return [];
  }

  const rpcParams = bboxToCategorizedRpcParams(bbox);
  auditRpcParams(bbox, rpcParams);

  const rpcCall = supabase.rpc('get_categorized_spots_in_bbox', rpcParams);

  if (signal) {
    signal.addEventListener('abort', () => void rpcCall, { once: true });
  }

  try {
    const { data, error } = await rpcCall;

    if (error) {
      if (isRpcNotFound(error)) {
        if (__DEV__) {
          console.warn(
            '[categorizedSpots] RPC get_categorized_spots_in_bbox not deployed — using fallback. Run supabase/apply_map_pins_fix.sql in the Supabase SQL Editor.'
          );
        }
        return fetchCategorizedSpotsFallback(bbox, signal);
      }
      if (__DEV__) console.error('RPC Error:', error);
      throw new Error(error.message);
    }

    let result = parseRpcPayload(data, bbox);
    if (countCategorizedSpots(result) === 0) {
      if (__DEV__) {
        console.warn(
          '[categorizedSpots] Primary RPC returned no spots — trying fallback sources'
        );
      }
      return fetchCategorizedSpotsFallback(bbox, signal);
    }

    result = await enrichSparseDiscoveryResult(bbox, result, signal);
    return result;
  } catch (error) {
    if (__DEV__) console.error('RPC Error:', error);
    throw error;
  }
}

export function countCategorizedSpots(categories: CategorizedSpotsResponse): number {
  return categories.reduce((sum, group) => sum + group.spots.length, 0);
}

export function flattenCategorizedSpots(categories: CategorizedSpotsResponse): NearbySpot[] {
  return categories.flatMap((group) => group.spots);
}
