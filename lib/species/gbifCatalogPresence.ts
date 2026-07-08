import {
  bboxAroundPoint,
  fetchGbifOccurrencesInBBox,
  type GbifOccurrence,
} from '@/lib/species/gbifSpecies';
import {
  getCachedPresenceNearPoint,
  setCachedPresenceNearPoint,
} from '@/lib/species/gbifPresenceCache';

/**
 * GBIF occurrences near a point, matched against the app catalog downstream.
 * Uses one bbox occurrence search (orderKey Perciformes) instead of per-species fan-out.
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

  const bbox = bboxAroundPoint(latitude, longitude, radiusKm);
  const occurrences = await fetchGbifOccurrencesInBBox(bbox, 100, signal);
  await setCachedPresenceNearPoint(latitude, longitude, radiusKm, occurrences);
  return occurrences;
}

/** @deprecated Taxon keys are no longer fetched per catalog species. */
export { resetGbifTaxonKeyCache } from '@/lib/species/gbifTaxonKeyCache';
