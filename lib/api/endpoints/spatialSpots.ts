import { bffRequest } from '@/lib/api/client';
import { isBffEnabled } from '@/lib/api/config';
import { NearbySpot } from '@/utils/osmFishingSpots';
import { calculateDistance } from '@/utils/geo';

/** [minLon, minLat, maxLon, maxLat] — GeoJSON bbox order */
export type BBox = [number, number, number, number];

/** Grid size in degrees for spatial tile snapping (~17 mi at the equator) */
const TILE_GRID_DEGREES = 0.25;

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
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const centerLon = (minLon + maxLon) / 2;
  const centerLat = (minLat + maxLat) / 2;
  const halfSpan = MAX_BBOX_SPAN_DEGREES / 2;

  return [
    Math.max(minLon, centerLon - halfSpan),
    Math.max(minLat, centerLat - halfSpan),
    Math.min(maxLon, centerLon + halfSpan),
    Math.min(maxLat, centerLat + halfSpan),
  ];
}

export function bboxCacheKey(bbox: BBox): string {
  return bbox.map((v) => v.toFixed(2)).join(',');
}

interface BffSpotsResponse {
  spots: NearbySpot[];
}

/**
 * Global spatial fetch — documented fishing spots inside a bounding box,
 * anywhere in the world. BFF's Global Spatial Router first (aggregated
 * Overpass + GBIF with server caching); direct sources as fallback.
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
      console.warn('BFF spatial router unavailable, falling back to direct fetch:', error);
    }
  }

  const [osmSpots, gbifSpots] = await Promise.all([
    fetchOsmSpotsInBBox(clamped, signal).catch((error) => {
      console.warn('Overpass bbox fetch failed:', error);
      return [] as NearbySpot[];
    }),
    fetchGbifSpotsInBBox(clamped, signal).catch((error) => {
      console.warn('GBIF bbox fetch failed:', error);
      return [] as NearbySpot[];
    }),
  ]);

  return dedupeSpots([...osmSpots, ...gbifSpots], clamped);
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

    spots.push({
      id: `osm-${element.type}-${element.id}`,
      name: element.tags.name ?? element.tags['name:en'] ?? 'Fishing Spot',
      description: element.tags.description ?? null,
      latitude: lat,
      longitude: lon,
      water_type: element.tags['man_made'] === 'pier' ? 'coastal' : 'lake',
      species: [],
      facilities: element.tags['man_made'] === 'pier' ? ['pier'] : [],
      best_months: [],
      rating: 4.0,
      created_at: new Date().toISOString(),
      distance: Math.round(calculateDistance(centerLat, centerLon, lat, lon) * 10) / 10,
      matchedSpecies: [],
      isPeakSeason: false,
    });
  }

  return spots;
}

// ---------------------------------------------------------------------------
// Direct source: GBIF occurrence API (documented fish observations worldwide)
// ---------------------------------------------------------------------------

/**
 * Legacy GBIF backbone key for Actinopterygii (ray-finned fishes). GBIF's
 * 2025 checklist migration replaced the old small integer keys, so we resolve
 * the current key at runtime and only use this as a last-resort fallback.
 */
const GBIF_FISH_TAXON_KEY_FALLBACK = 204;

let cachedFishTaxonKey: number | null = null;

async function resolveGbifFishTaxonKey(signal?: AbortSignal): Promise<number> {
  if (cachedFishTaxonKey != null) return cachedFishTaxonKey;

  // 1. Backbone name match (works on the classic API)
  try {
    const response = await fetch(
      'https://api.gbif.org/v1/species/match?name=Actinopterygii&rank=class',
      { signal }
    );
    if (response.ok) {
      const data = await response.json();
      // Old API shape: { usageKey } — new checklist API shape: { usage: { key } }
      const key = data.usageKey ?? data.usage?.key;
      if (typeof key === 'number') {
        cachedFishTaxonKey = key;
        return key;
      }
    }
  } catch {
    // try next strategy
  }

  // 2. Derive the live classKey from a known fish occurrence record
  try {
    const response = await fetch(
      'https://api.gbif.org/v1/occurrence/search?scientificName=Perca%20fluviatilis&limit=1',
      { signal }
    );
    if (response.ok) {
      const data = await response.json();
      const classKey = data.results?.[0]?.classKey;
      if (typeof classKey === 'number') {
        cachedFishTaxonKey = classKey;
        return classKey;
      }
    }
  } catch {
    // fall through to legacy key
  }

  cachedFishTaxonKey = GBIF_FISH_TAXON_KEY_FALLBACK;
  return cachedFishTaxonKey;
}

async function fetchGbifSpotsInBBox(bbox: BBox, signal?: AbortSignal): Promise<NearbySpot[]> {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const taxonKey = await resolveGbifFishTaxonKey(signal);

  const url =
    `https://api.gbif.org/v1/occurrence/search?taxonKey=${taxonKey}` +
    `&decimalLatitude=${minLat},${maxLat}&decimalLongitude=${minLon},${maxLon}` +
    `&hasCoordinate=true&limit=200`;

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`GBIF error: ${response.status}`);

  const data = await response.json();
  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;

  // Group individual occurrence records into per-location spots
  const grouped = new Map<string, { lat: number; lon: number; species: Set<string> }>();

  for (const occurrence of data.results ?? []) {
    const lat = occurrence.decimalLatitude;
    const lon = occurrence.decimalLongitude;
    if (lat == null || lon == null) continue;

    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    const entry = grouped.get(key) ?? { lat, lon, species: new Set<string>() };
    const name = occurrence.vernacularName ?? occurrence.species;
    if (name) entry.species.add(name);
    grouped.set(key, entry);
  }

  return Array.from(grouped.entries()).map(([key, entry]) => ({
    id: `gbif-${key}`,
    name:
      entry.species.size > 0
        ? `Documented: ${Array.from(entry.species)[0]}`
        : 'Documented Fish Location',
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
    matchedSpecies: Array.from(entry.species).slice(0, 3),
    isPeakSeason: false,
  }));
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
