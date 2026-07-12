import { bffRequest } from '@/lib/api/client';
import { isBffEnabled } from '@/lib/api/config';
import speciesData from '@/data/species.json';

export type SpeciesRecord = (typeof speciesData)[number];

/**
 * Species catalog — bundled data today; the BFF route will later enrich it
 * with GBIF occurrence lookups scoped to the user's region.
 */
export async function fetchSpeciesCatalog(
  latitude?: number,
  longitude?: number,
  signal?: AbortSignal
): Promise<SpeciesRecord[]> {
  if (isBffEnabled() && latitude != null && longitude != null) {
    try {
      return await bffRequest<SpeciesRecord[]>('/api/species', {
        params: { lat: latitude, lon: longitude },
        signal,
      });
    } catch (error) {
      if (__DEV__) console.warn('BFF species unavailable, using bundled catalog:', error);
    }
  }

  return speciesData;
}
