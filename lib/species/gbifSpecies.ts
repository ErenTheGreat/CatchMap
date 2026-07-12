/** [minLng, minLat, maxLng, maxLat] — west/south/east/north order */
export type GbifBBox = [number, number, number, number];

export interface GbifOccurrence {
  scientificName: string;
  vernacularName: string | null;
  speciesKey: number | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Sport-fish orders queried in parallel for bbox occurrence searches.
 * Broader than Perciformes-only so trout, salmon, catfish, pike, etc. are included.
 */
export const GBIF_SPORT_FISH_ORDER_KEYS = [
  587, // Perciformes (bass, perch, sunfish in GBIF)
  593, // Salmoniformes (trout, salmon)
  630, // Siluriformes (catfish)
  580, // Esociformes (pike, musky)
  445, // Acipenseriformes (sturgeon)
  637, // Pleuronectiformes (flounder, halibut)
] as const;

/**
 * Legacy GBIF backbone key for Actinopterygii (ray-finned fishes). GBIF's
 * 2025 checklist migration replaced the old small integer keys, so we resolve
 * the current key at runtime and only use this as a last-resort fallback.
 */
const GBIF_FISH_TAXON_KEY_FALLBACK = 204;

let cachedFishTaxonKey: number | null = null;

export async function resolveGbifFishTaxonKey(signal?: AbortSignal): Promise<number> {
  if (cachedFishTaxonKey != null) return cachedFishTaxonKey;

  try {
    const response = await fetch(
      'https://api.gbif.org/v1/species/match?name=Actinopterygii&rank=class',
      { signal }
    );
    if (response.ok) {
      const data = await response.json();
      const key = data.usageKey ?? data.usage?.key;
      if (typeof key === 'number') {
        cachedFishTaxonKey = key;
        return key;
      }
    }
  } catch {
    // try next strategy
  }

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

export function bboxAroundPoint(
  latitude: number,
  longitude: number,
  radiusKm: number
): GbifBBox {
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));
  return [
    longitude - lonDelta,
    latitude - latDelta,
    longitude + lonDelta,
    latitude + latDelta,
  ];
}

function parseGbifOccurrence(raw: Record<string, unknown>): GbifOccurrence | null {
  const scientificName = raw.scientificName ?? raw.species;
  if (typeof scientificName !== 'string' || !scientificName.trim()) {
    return null;
  }

  const vernacularName =
    typeof raw.vernacularName === 'string' ? raw.vernacularName : null;
  const speciesKey = typeof raw.speciesKey === 'number' ? raw.speciesKey : null;
  const latitude =
    typeof raw.decimalLatitude === 'number' ? raw.decimalLatitude : null;
  const longitude =
    typeof raw.decimalLongitude === 'number' ? raw.decimalLongitude : null;

  return {
    scientificName: scientificName.trim(),
    vernacularName,
    speciesKey,
    latitude,
    longitude,
  };
}

function dedupeOccurrences(occurrences: GbifOccurrence[]): GbifOccurrence[] {
  const byKey = new Map<string, GbifOccurrence>();
  for (const occurrence of occurrences) {
    const dedupeKey =
      occurrence.speciesKey != null
        ? String(occurrence.speciesKey)
        : normalizeOccurrenceKey(occurrence.scientificName);
    if (!byKey.has(dedupeKey)) {
      byKey.set(dedupeKey, occurrence);
    }
  }
  return Array.from(byKey.values());
}

function normalizeOccurrenceKey(scientificName: string): string {
  const parts = scientificName.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts.join(' ');
}

async function fetchGbifOccurrencesForOrder(
  bbox: GbifBBox,
  orderKey: number,
  limit: number,
  signal?: AbortSignal
): Promise<GbifOccurrence[]> {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const url =
    `https://api.gbif.org/v1/occurrence/search?orderKey=${orderKey}` +
    `&decimalLatitude=${minLat},${maxLat}&decimalLongitude=${minLon},${maxLon}` +
    `&hasCoordinate=true&hasGeospatialIssue=false&limit=${limit}`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`GBIF error: ${response.status}`);
  }

  const data = await response.json();
  const occurrences: GbifOccurrence[] = [];

  for (const raw of data.results ?? []) {
    const occurrence = parseGbifOccurrence(raw as Record<string, unknown>);
    if (occurrence) {
      occurrences.push(occurrence);
    }
  }

  return occurrences;
}

async function fetchGbifOccurrencesForTaxonKey(
  bbox: GbifBBox,
  taxonKey: number,
  limit: number,
  signal?: AbortSignal
): Promise<GbifOccurrence[]> {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const url =
    `https://api.gbif.org/v1/occurrence/search?taxonKey=${taxonKey}` +
    `&decimalLatitude=${minLat},${maxLat}&decimalLongitude=${minLon},${maxLon}` +
    `&hasCoordinate=true&hasGeospatialIssue=false&limit=${limit}`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`GBIF error: ${response.status}`);
  }

  const data = await response.json();
  const occurrences: GbifOccurrence[] = [];

  for (const raw of data.results ?? []) {
    const occurrence = parseGbifOccurrence(raw as Record<string, unknown>);
    if (occurrence) {
      occurrences.push(occurrence);
    }
  }

  return occurrences;
}

export async function fetchGbifOccurrencesInBBox(
  bbox: GbifBBox,
  limit: number = 100,
  signal?: AbortSignal
): Promise<GbifOccurrence[]> {
  const perOrderLimit = Math.max(15, Math.ceil(limit / GBIF_SPORT_FISH_ORDER_KEYS.length));

  const orderResults = await Promise.all(
    GBIF_SPORT_FISH_ORDER_KEYS.map(async (orderKey) => {
      try {
        return await fetchGbifOccurrencesForOrder(bbox, orderKey, perOrderLimit, signal);
      } catch {
        return [];
      }
    })
  );

  const merged = dedupeOccurrences(orderResults.flat());
  if (merged.length > 0) {
    return merged.slice(0, limit);
  }

  try {
    const fishTaxonKey = await resolveGbifFishTaxonKey(signal);
    const classLevel = await fetchGbifOccurrencesForTaxonKey(
      bbox,
      fishTaxonKey,
      limit,
      signal
    );
    return classLevel.slice(0, limit);
  } catch {
    return [];
  }
}

export async function fetchGbifSpeciesNearPoint(
  latitude: number,
  longitude: number,
  radiusKm: number = 2,
  signal?: AbortSignal
): Promise<GbifOccurrence[]> {
  const bbox = bboxAroundPoint(latitude, longitude, radiusKm);
  return fetchGbifOccurrencesInBBox(bbox, 100, signal);
}

/** Reset cached taxon key — for tests only. */
export function resetGbifFishTaxonKeyCache(): void {
  cachedFishTaxonKey = null;
}
