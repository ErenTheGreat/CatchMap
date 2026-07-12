import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  enrichRegionTileKey,
  fetchEnrichRegion,
  snapCoordsToTileGrid,
  type EnrichRegionResult,
} from '@/lib/api/endpoints/enrichRegion';
import { isCloudSyncEnabled } from '@/constants/features';
import { useNetworkStatus } from '@/providers/NetworkProvider';

const ENRICH_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const DEBOUNCE_MS = 2000;

interface UseRegionEnrichmentOptions {
  latitude: number | null;
  longitude: number | null;
  waterType?: 'saltwater' | 'freshwater' | 'brackish';
  enabled?: boolean;
}

/**
 * Debounced background enrichment when the map viewport center moves to a new tile.
 * Requires signed-in user + online (JWT for enrich-region Edge Function).
 */
export function useRegionEnrichment({
  latitude,
  longitude,
  waterType,
  enabled = true,
}: UseRegionEnrichmentOptions) {
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTileRef = useRef<string | null>(null);

  const canEnrich =
    enabled && isCloudSyncEnabled() && isOnline && latitude != null && longitude != null;

  const tileKey = canEnrich ? enrichRegionTileKey(latitude!, longitude!) : null;

  const query = useQuery({
    queryKey: ['enrichRegion', tileKey, waterType],
    queryFn: ({ signal }) =>
      fetchEnrichRegion(
        { latitude: latitude!, longitude: longitude!, waterType },
        signal
      ) as Promise<EnrichRegionResult | null>,
    enabled: false,
    staleTime: ENRICH_STALE_MS,
    gcTime: ENRICH_STALE_MS,
  });

  useEffect(() => {
    if (!canEnrich || !tileKey) return;
    if (lastTileRef.current === tileKey) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const cached = queryClient.getQueryData<EnrichRegionResult | null>([
        'enrichRegion',
        tileKey,
        waterType,
      ]);
      if (cached?.cached) {
        lastTileRef.current = tileKey;
        return;
      }

      void queryClient
        .fetchQuery({
          queryKey: ['enrichRegion', tileKey, waterType],
          queryFn: ({ signal }) =>
            fetchEnrichRegion(
              { latitude: latitude!, longitude: longitude!, waterType },
              signal
            ),
          staleTime: ENRICH_STALE_MS,
        })
        .then((result) => {
          lastTileRef.current = tileKey;
          if (result && result.species.length > 0) {
            void queryClient.invalidateQueries({ queryKey: ['speciesAvailability'] });
          }
        })
        .catch((error) => {
          if (__DEV__) console.warn('[enrichRegion] fetch failed:', error);
          lastTileRef.current = null;
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [canEnrich, tileKey, latitude, longitude, waterType, queryClient]);

  return {
    tileCenter: canEnrich ? snapCoordsToTileGrid(latitude!, longitude!) : null,
    enrichment: query.data ?? null,
    isEnriching: query.isFetching,
    tileKey,
  };
}
