import speciesCatalog from '@/data/species.json';
import {
  bboxAroundPoint,
  type GbifOccurrence,
} from '@/lib/species/gbifSpecies';
import {
  getCachedPresenceNearPoint,
  setCachedPresenceNearPoint,
} from '@/lib/species/gbifPresenceCache';
import {
  getCachedTaxonKey,
  resetGbifTaxonKeyCache,
  setCachedTaxonKey,
} from '@/lib/species/gbifTaxonKeyCache';
import type { SpeciesCatalogEntry } from '@/lib/types/speciesGuide';

const catalogEntries = speciesCatalog as SpeciesCatalogEntry[];

function parseGbifOccurrence(raw: Record<string, unknown>): GbifOccurrence | null {
  const scientificName = raw.scientificName ?? raw.species;
  if (typeof scientificName !== 'string' || !scientificName.trim()) {
    return null;
  }

  return {
    scientificName: scientificName.trim(),
    vernacularName:
      typeof raw.vernacularName === 'string' ? raw.vernacularName : null,
    speciesKey: typeof raw.speciesKey === 'number' ? raw.speciesKey : null,
    latitude:
      typeof raw.decimalLatitude === 'number' ? raw.decimalLatitude : null,
    longitude:
      typeof raw.decimalLongitude === 'number' ? raw.decimalLongitude : null,
  };
}

async function resolveCatalogTaxonKey(
  scientificName: string,
  signal?: AbortSignal
): Promise<number | null> {
  const cached = await getCachedTaxonKey(scientificName);
  if (cached !== undefined) {
    return cached;
  }

  const response = await fetch(
    `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(scientificName)}`,
    { signal }
  );
  if (!response.ok) {
    await setCachedTaxonKey(scientificName, null);
    return null;
  }

  const data = await response.json();
  if (data.matchType === 'NONE' || typeof data.usageKey !== 'number') {
    await setCachedTaxonKey(scientificName, null);
    return null;
  }

  await setCachedTaxonKey(scientificName, data.usageKey);
  return data.usageKey;
}

async function hasOccurrenceNearPoint(
  taxonKey: number,
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number,
  signal?: AbortSignal
): Promise<GbifOccurrence | null> {
  const url =
    `https://api.gbif.org/v1/occurrence/search?taxonKey=${taxonKey}` +
    `&decimalLatitude=${minLat},${maxLat}` +
    `&decimalLongitude=${minLon},${maxLon}` +
    `&hasCoordinate=true&hasGeospatialIssue=false&limit=1`;

  const response = await fetch(url, { signal });
  if (!response.ok) return null;

  const data = await response.json();
  if (!data.count || !Array.isArray(data.results) || data.results.length === 0) {
    return null;
  }

  return parseGbifOccurrence(data.results[0] as Record<string, unknown>);
}

async function fetchPresenceFromGbif(
  latitude: number,
  longitude: number,
  radiusKm: number,
  signal?: AbortSignal
): Promise<GbifOccurrence[]> {
  const [minLon, minLat, maxLon, maxLat] = bboxAroundPoint(
    latitude,
    longitude,
    radiusKm
  );

  const checks = await Promise.all(
    catalogEntries.map(async (entry) => {
      const taxonKey = await resolveCatalogTaxonKey(entry.scientificName, signal);
      if (taxonKey == null) return null;

      return hasOccurrenceNearPoint(
        taxonKey,
        minLat,
        maxLat,
        minLon,
        maxLon,
        signal
      );
    })
  );

  return checks.filter((occurrence): occurrence is GbifOccurrence => occurrence != null);
}

/**
 * Check each catalog species individually against GBIF occurrences near a point.
 * The class-level Actinopterygii taxonKey no longer returns occurrence results;
 * per-species taxonKey queries do.
 */
export async function fetchCatalogSpeciesPresenceNearPoint(
  latitude: number,
  longitude: number,
  radiusKm: number,
  signal?: AbortSignal
): Promise<GbifOccurrence[]> {
  const cached = await getCachedPresenceNearPoint(latitude, longitude, radiusKm);
  if (cached !== undefined) {
    return cached;
  }

  const occurrences = await fetchPresenceFromGbif(latitude, longitude, radiusKm, signal);
  await setCachedPresenceNearPoint(latitude, longitude, radiusKm, occurrences);
  return occurrences;
}

/** Reset cached taxon keys — for tests only. */
export { resetGbifTaxonKeyCache };
