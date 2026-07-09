import {
  bboxAroundPoint,
  fetchGbifOccurrencesInBBox,
  type GbifOccurrence,
} from '@/lib/species/gbifSpecies';
import {
  getCachedPresenceNearPoint,
  setCachedPresenceNearPoint,
} from '@/lib/species/gbifPresenceCache';
import { fetchEnrichRegion } from '@/lib/api/endpoints/enrichRegion';
import { isCloudSyncEnabled } from '@/constants/features';

/**
 * GBIF occurrences near a point, matched against the app catalog downstream.
 * When signed in, triggers server-side enrich-region first so Postgres-backed
 * species_near_point results stay in sync with the tile cache.
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

  if (isCloudSyncEnabled()) {
    await fetchEnrichRegion({ latitude, longitude, radiusKm }, signal);
  }

  const bbox = bboxAroundPoint(latitude, longitude, radiusKm);
  const occurrences = await fetchGbifOccurrencesInBBox(bbox, 100, signal);
  await setCachedPresenceNearPoint(latitude, longitude, radiusKm, occurrences);
  return occurrences;
}

/** @deprecated Taxon keys are no longer fetched per catalog species. */
export { resetGbifTaxonKeyCache } from '@/lib/species/gbifTaxonKeyCache';
