import { bffRequest } from '@/lib/api/client';
import { isBffEnabled } from '@/lib/api/config';
import { supabase } from '@/lib/supabase';
import { fetchGbifOccurrencesInBBox } from '@/lib/species/gbifSpecies';
import {
  NearbySpot,
  getSpotName,
  inferFacilities,
  inferWaterType,
} from '@/utils/osmFishingSpots';
import { calculateDistance } from '@/utils/geo';
import { enrichNearbySpotFromLocation } from '@/utils/spotMetadata';

/** [minLng, minLat, maxLng, maxLat] — west/south/east/north viewport order */
export type BBox = [number, number, number, number];

/** Grid size in degrees for spatial tile snapping (~17 mi at the equator) */
const TILE_GRID_DEGREES = 0.25;

/** Build a square viewport (~city zoom) centered on a lat/lng pair. */
export function bboxAroundCenter(
  lat: number,
  lng: number,
  spanDegrees = 0.2
): BBox {
  const half = spanDegrees / 2;
  return [lng - half, lat - half, lng + half, lat + half];
}

/** Max bbox span sent upstream — protects Overpass/GBIF from continent-size queries */
const MAX_BBOX_SPAN_DEGREES = 2;

/**
 * Snap a bbox outward to the tile grid. Nearby camera positions resolve to
 * the same snapped bbox, so TanStack Query reuses one cache entry ("spatial
 * tile") instead of refetching on every pixel of camera movement.
 */
export function snapBBoxToTileGrid(bbox: BBox): BBox {
  const snap = (value: number, up: boolean) =>
    (up ? Math.ceil : Math.floor)(value / TILE_GRID_DEGREES) * TILE_GRID_DEGREES;
  return [
    snap(bbox[0], false),
    snap(bbox[1], false),
    snap(bbox[2], true),
    snap(bbox[3], true),
  ];
}

/** Clamp an oversized bbox to its center region so upstream queries stay sane */
export function clampBBox(bbox: BBox): BBox {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;
  const halfSpan = MAX_BBOX_SPAN_DEGREES / 2;

  return [
    Math.max(minLng, centerLng - halfSpan),
    Math.max(minLat, centerLat - halfSpan),
    Math.min(maxLng, centerLng + halfSpan),
    Math.min(maxLat, centerLat + halfSpan),
  ];
}

/** Serialize viewport bounds for TanStack Query: `${minLng},${minLat},${maxLng},${maxLat}` */
export function bboxCacheKey(bbox: BBox): string {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return [minLng, minLat, maxLng, maxLat].map((v) => v.toFixed(2)).join(',');
}

/** Parse a query cache key back into four float viewport bounds. */
export function parseBboxCacheKey(cacheKey: string): BBox | null {
  const parts = cacheKey.split(',').map((part) => parseFloat(part.trim()));
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) {
    return null;
  }

  const [minLng, minLat, maxLng, maxLat] = parts;
  if (maxLng <= minLng || maxLat <= minLat) {
    return null;
  }

  return [minLng, minLat, maxLng, maxLat];
}

function isValidBBox(bbox: BBox): boolean {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return (
    [minLng, minLat, maxLng, maxLat].every(Number.isFinite) &&
    maxLng > minLng &&
    maxLat > minLat
  );
}

/**
 * Normalize raw map viewport bounds into [minLng, minLat, maxLng, maxLat].
 *
 * MapLibre LngLatBounds / getBounds() order: [west, south, east, north]
 * (= minLng, minLat, maxLng, maxLat). We min/max defensively in case a
 * provider returns corners out of order.
 */
export function normalizeViewportBounds(raw: unknown): BBox | null {
  let candidate = raw;

  if (
    candidate &&
    typeof candidate === 'object' &&
    !Array.isArray(candidate) &&
    'bounds' in (candidate as Record<string, unknown>)
  ) {
    candidate = (candidate as { bounds: unknown }).bounds;
  }

  if (!Array.isArray(candidate) || candidate.length !== 4) {
    return null;
  }

  const values = candidate.map(Number);
  if (values.some((value) => !Number.isFinite(value))) {
    return null;
  }

  const [first, second, third, fourth] = values;

  // Detect [minLat, minLng, maxLat, maxLng] mistake (lat values in ±90, lng in ±180)
  const looksLikeLatLngOrder =
    Math.abs(first) <= 90 &&
    Math.abs(second) <= 180 &&
    Math.abs(third) <= 90 &&
    Math.abs(fourth) <= 180 &&
    (Math.abs(first) > 20 || Math.abs(third) > 20) &&
    Math.abs(second) > Math.abs(first) &&
    Math.abs(fourth) > Math.abs(third);

  let minLng: number;
  let minLat: number;
  let maxLng: number;
  let maxLat: number;

  if (looksLikeLatLngOrder) {
    if (__DEV__) {
      console.warn(
        '[normalizeViewportBounds] Detected [minLat, minLng, maxLat, maxLng] — swapping to [minLng, minLat, maxLng, maxLat]',
        candidate
      );
    }
    minLat = Math.min(first, third);
    maxLat = Math.max(first, third);
    minLng = Math.min(second, fourth);
    maxLng = Math.max(second, fourth);
  } else {
    // Standard MapLibre [west, south, east, north]
    minLng = Math.min(first, third);
    maxLng = Math.max(first, third);
    minLat = Math.min(second, fourth);
    maxLat = Math.max(second, fourth);
  }

  const bbox: BBox = [minLng, minLat, maxLng, maxLat];
  return isValidBBox(bbox) ? bbox : null;
}

/** Map viewport bounds to Supabase get_locations_in_bbox RPC parameters. */
export function bboxToRpcParams(bbox: BBox): {
  min_lng: number;
  min_lat: number;
  max_lng: number;
  max_lat: number;
} {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return {
    min_lng: minLng,
    min_lat: minLat,
    max_lng: maxLng,
    max_lat: maxLat,
  };
}

interface BffSpotsResponse {
  spots: NearbySpot[];
}

function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'AbortError' ||
    error.name === 'CancelledError' ||
    /aborted|cancel/i.test(error.message)
  );
}

function logSpatialFetchWarning(source: string, error: unknown): void {
  if (isAbortError(error)) return;
  if (__DEV__) console.warn(`${source} bbox fetch failed:`, error);
}

/**
 * Viewport spatial fetch — PostGIS locations first (deployed RPC), then optional
 * Overpass/GBIF only when the viewport has no curated database rows.
 */
export async function fetchSpotsInBBox(bbox: BBox, signal?: AbortSignal): Promise<NearbySpot[]> {
  const clamped = clampBBox(bbox);

  if (isBffEnabled()) {
    try {
      const data = await bffRequest<BffSpotsResponse>('/api/spots-bbox', {
        params: { bbox: clamped.join(',') },
        signal,
      });
      return data.spots ?? [];
    } catch (error) {
      if (__DEV__ && !isAbortError(error)) {
        console.warn('BFF spatial router unavailable, falling back to direct fetch:', error);
      }
    }
  }

  if (signal?.aborted) return [];

  const postgisSpots = await fetchPostgisLocationsInBBox(clamped, signal).catch((error) => {
    logSpatialFetchWarning('PostGIS', error);
    return [] as NearbySpot[];
  });

  if (signal?.aborted) return postgisSpots;

  if (postgisSpots.length > 0) {
    return dedupeSpots(postgisSpots, clamped);
  }

  // External APIs are rate-limited — only hit them when PostGIS has no viewport rows.
  const [osmSpots, gbifSpots] = await Promise.all([
    fetchOsmSpotsInBBox(clamped, signal).catch((error) => {
      logSpatialFetchWarning('Overpass', error);
      return [] as NearbySpot[];
    }),
    fetchGbifSpotsInBBox(clamped, signal).catch((error) => {
      logSpatialFetchWarning('GBIF', error);
      return [] as NearbySpot[];
    }),
  ]);

  return dedupeSpots([...postgisSpots, ...osmSpots, ...gbifSpots], clamped);
}

// ---------------------------------------------------------------------------
// Direct source: Supabase PostGIS locations table (viewport envelope query)
// ---------------------------------------------------------------------------

interface PostgisLocationRow {
  id: string;
  name: string;
  water_type: string;
  latitude: number;
  longitude: number;
}

async function fetchPostgisLocationsInBBox(
  bbox: BBox,
  signal?: AbortSignal
): Promise<NearbySpot[]> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  const rpcCall = supabase.rpc(
    'get_locations_in_bbox',
    bboxToRpcParams([minLng, minLat, maxLng, maxLat])
  );

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

  return ((data ?? []) as PostgisLocationRow[]).map((row) =>
    enrichNearbySpotFromLocation({
      id: `postgis-${row.id}`,
      name: row.name,
      description: null,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      water_type: row.water_type ?? 'freshwater',
      species: [],
      facilities: [],
      best_months: [],
      rating: 4.0,
      created_at: new Date().toISOString(),
      distance:
        Math.round(
          calculateDistance(centerLat, centerLng, Number(row.latitude), Number(row.longitude)) * 10
        ) / 10,
      matchedSpecies: [],
      isPeakSeason: false,
    })
  );
}

// ---------------------------------------------------------------------------
// Direct source: OpenStreetMap Overpass (documented fishing spots + piers)
// ---------------------------------------------------------------------------

async function fetchOsmSpotsInBBox(bbox: BBox, signal?: AbortSignal): Promise<NearbySpot[]> {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  // Overpass bbox order is (south, west, north, east)
  const overpassBBox = `${minLat},${minLon},${maxLat},${maxLon}`;

  const query = `
    [out:json][timeout:25];
    (
      node["leisure"="fishing"](${overpassBBox});
      way["leisure"="fishing"](${overpassBBox});
      node["sport"="fishing"](${overpassBBox});
      node["man_made"="pier"]["fishing"="yes"](${overpassBBox});
      way["man_made"="pier"]["fishing"="yes"](${overpassBBox});
    );
    out center 100;
  `;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'fishing-app/1.0',
    },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  });
  if (!response.ok) throw new Error(`Overpass error: ${response.status}`);

  const data = await response.json();
  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;
  const spots: NearbySpot[] = [];

  for (const element of data.elements ?? []) {
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (lat == null || lon == null || !element.tags) continue;

    const tags = element.tags;
    const waterType = inferWaterType(tags);

    spots.push(
      enrichNearbySpotFromLocation({
        id: `osm-${element.type}-${element.id}`,
        name: getSpotName(tags),
        description: tags.description ?? tags.note ?? null,
        latitude: lat,
        longitude: lon,
        water_type: waterType,
        species: [],
        facilities: inferFacilities(tags),
        best_months: [],
        rating: tags['fishing:rating'] ? parseFloat(tags['fishing:rating']) : 4.0,
        created_at: new Date().toISOString(),
        distance: Math.round(calculateDistance(centerLat, centerLon, lat, lon) * 10) / 10,
        matchedSpecies: [],
        isPeakSeason: false,
      })
    );
  }

  return spots;
}

// ---------------------------------------------------------------------------
// Direct source: GBIF occurrence API (documented fish observations worldwide)
// ---------------------------------------------------------------------------

async function fetchGbifSpotsInBBox(bbox: BBox, signal?: AbortSignal): Promise<NearbySpot[]> {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const occurrences = await fetchGbifOccurrencesInBBox(bbox, 200, signal);
  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;

  const grouped = new Map<string, { lat: number; lon: number; species: Set<string> }>();

  for (const occurrence of occurrences) {
    const lat = occurrence.latitude;
    const lon = occurrence.longitude;
    if (lat == null || lon == null) continue;

    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    const entry = grouped.get(key) ?? { lat, lon, species: new Set<string>() };
    const name = occurrence.vernacularName ?? occurrence.scientificName;
    if (name) entry.species.add(name);
    grouped.set(key, entry);
  }

  return Array.from(grouped.entries()).map(([key, entry]) => {
    const speciesNames = Array.from(entry.species).slice(0, 3);
    return enrichNearbySpotFromLocation({
      id: `gbif-${key}`,
      name: 'Documented Fish Location',
      description: 'Documented fish occurrence (GBIF)',
      latitude: entry.lat,
      longitude: entry.lon,
      water_type: 'lake',
      species: [],
      facilities: [],
      best_months: [],
      rating: 3.5,
      created_at: new Date().toISOString(),
      distance:
        Math.round(calculateDistance(centerLat, centerLon, entry.lat, entry.lon) * 10) / 10,
      matchedSpecies: speciesNames,
      isPeakSeason: false,
    });
  });
}

// ---------------------------------------------------------------------------

/** Drop points within ~0.15 mi of an already-kept point (OSM spots win) */
function dedupeSpots(spots: NearbySpot[], bbox: BBox): NearbySpot[] {
  const kept: NearbySpot[] = [];

  for (const spot of spots) {
    const isDuplicate = kept.some(
      (existing) =>
        calculateDistance(existing.latitude, existing.longitude, spot.latitude, spot.longitude) <
        0.15
    );
    if (!isDuplicate) kept.push(spot);
  }

  return kept.sort((a, b) => a.distance - b.distance).slice(0, 300);
}
