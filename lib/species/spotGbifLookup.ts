import { findBundledSpot } from '@/lib/api/endpoints/bundledSpeciesAvailability';
import { resolvePostgisLocationUuid } from '@/lib/api/bundledLocationIds';

/** Bulk-imported PostGIS spots usually need a GBIF lookup after category RPC fallback. */
export function spotLikelyNeedsGbifLookup(locationId: string | null): boolean {
  if (!locationId || findBundledSpot(locationId)) {
    return false;
  }

  return resolvePostgisLocationUuid(locationId) != null;
}
