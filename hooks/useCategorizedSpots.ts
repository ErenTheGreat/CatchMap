import { useCallback, useEffect, useRef, useState } from 'react';
import { fishingApi, BBox } from '@/lib/api/fishingApi';
import {
  bboxAroundCenter,
  bboxCacheKey,
  snapBBoxToTileGrid,
} from '@/lib/api/endpoints/spatialSpots';
import {
  countCategorizedSpots,
  flattenCategorizedSpots,
  isDiscoveryBBoxTooLarge,
} from '@/lib/api/endpoints/categorizedSpots';
import {
  bboxToLogCoords,
  auditBBoxAgainstReference,
  EAST_BAY_DISCOVERY_BBOX,
} from '@/lib/mapViewport';
import type { CategorizedSpotsResponse } from '@/lib/types/categorizedSpots';
import type { NearbySpot } from '@/utils/osmFishingSpots';
import { queryClient, STALE_TIME_MS } from '@/lib/queryClient';

const VIEWPORT_DEBOUNCE_MS = 1000;

type CategorizedSpotsQueryKey = readonly ['categorizedSpots', string];

const EMPTY_CATEGORIES: CategorizedSpotsResponse = [];

function isValidBBox(bbox: BBox): boolean {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return (
    [minLng, minLat, maxLng, maxLat].every(Number.isFinite) &&
    maxLng > minLng &&
    maxLat > minLat
  );
}

function readCachedCategories(cacheKey: string): CategorizedSpotsResponse | undefined {
  return queryClient.getQueryData<CategorizedSpotsResponse>([
    'categorizedSpots',
    cacheKey,
  ] satisfies CategorizedSpotsQueryKey);
}

/** Merge categorized + flat bbox spots for the current viewport (deduped by id). */
function mergeViewportSpots(
  categories: CategorizedSpotsResponse,
  bboxSpots: NearbySpot[]
): NearbySpot[] {
  const byId = new Map<string, NearbySpot>();
  for (const spot of flattenCategorizedSpots(categories)) {
    byId.set(spot.id, spot);
  }
  for (const spot of bboxSpots) {
    byId.set(spot.id, spot);
  }
  return Array.from(byId.values());
}

async function fetchCategoriesWithCache(bbox: BBox): Promise<CategorizedSpotsResponse> {
  const snapped = snapBBoxToTileGrid(bbox);
  const cacheKey = bboxCacheKey(snapped);
  const rpcParams = {
    p_min_lat: snapped[1],
    p_max_lat: snapped[3],
    p_min_lng: snapped[0],
    p_max_lng: snapped[2],
  };

  if (__DEV__) {
    console.log('[useCategorizedSpots] Query firing — RPC params (exact):', rpcParams);
    console.log('[useCategorizedSpots] BBox audit:', auditBBoxAgainstReference(snapped));
  }

  return queryClient.fetchQuery({
    queryKey: ['categorizedSpots', cacheKey] satisfies CategorizedSpotsQueryKey,
    queryFn: () => fishingApi.getCategorizedSpotsInBBox(snapped),
    staleTime: STALE_TIME_MS,
    gcTime: 24 * 60 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof Error && /429|504|rate.?limit|timeout/i.test(error.message)) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

function seedBboxForCenter(centerLat?: number, centerLng?: number): BBox {
  if (centerLat != null && centerLng != null && Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
    return bboxAroundCenter(centerLat, centerLng);
  }
  return EAST_BAY_DISCOVERY_BBOX;
}

/**
 * Viewport-synced categorized discovery query.
 *
 * - Fetches immediately on mount (East Bay seed or GPS-centered bbox).
 * - Debounces map viewport changes by 1s.
 * - Replaces map pins on each successful viewport fetch (no global pin cache).
 * - Clears pins when the viewport has no spots or is zoomed out too far.
 */
export function useCategorizedSpots(centerLat?: number, centerLng?: number) {
  const initialBbox = seedBboxForCenter(centerLat, centerLng);
  const initialCacheKey = bboxCacheKey(snapBBoxToTileGrid(initialBbox));
  const initialCached = readCachedCategories(initialCacheKey);

  const [viewportBBox, setViewportBBox] = useState<BBox | null>(initialBbox);
  const [displayedCategories, setDisplayedCategories] = useState<CategorizedSpotsResponse>(
    () => initialCached ?? EMPTY_CATEGORIES
  );
  const [viewportMapSpots, setViewportMapSpots] = useState<NearbySpot[]>(() =>
    initialCached ? mergeViewportSpots(initialCached, []) : []
  );
  const [isFetching, setIsFetching] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedKeyRef = useRef<string | null>(
    initialCached && countCategorizedSpots(initialCached) > 0 ? initialCacheKey : null
  );
  const activeRequestRef = useRef(0);
  const mountedRef = useRef(true);
  const centerSeedRef = useRef<string | null>(null);

  const fetchCategoriesForBBox = useCallback(async (rawBbox: BBox, options?: { force?: boolean }) => {
    if (!isValidBBox(rawBbox) || isDiscoveryBBoxTooLarge(rawBbox)) {
      return;
    }

    const cacheKey = bboxCacheKey(snapBBoxToTileGrid(rawBbox));
    if (!options?.force && cacheKey === lastFetchedKeyRef.current) {
      return;
    }

    const requestId = ++activeRequestRef.current;
    setIsFetching(true);

    try {
      const [data, bboxSpots] = await Promise.all([
        fetchCategoriesWithCache(rawBbox),
        fishingApi.getSpotsInBBox(rawBbox).catch((error) => {
          console.warn('[useCategorizedSpots] getSpotsInBBox failed:', error);
          return [] as NearbySpot[];
        }),
      ]);
      if (!mountedRef.current || requestId !== activeRequestRef.current) {
        return;
      }

      const mergedSpots = mergeViewportSpots(data, bboxSpots);

      if (mergedSpots.length === 0) {
        console.warn('[useCategorizedSpots] Empty bbox result — clearing viewport pins');
        lastFetchedKeyRef.current = cacheKey;
        setDisplayedCategories(EMPTY_CATEGORIES);
        setViewportMapSpots([]);
        return;
      }

      lastFetchedKeyRef.current = cacheKey;
      setDisplayedCategories(
        countCategorizedSpots(data) > 0
          ? data
          : [{ category: 'Nearby', spots: mergedSpots }]
      );
      setViewportMapSpots(mergedSpots);
    } catch (error) {
      if (mountedRef.current && requestId === activeRequestRef.current) {
        console.error('[useCategorizedSpots] Fetch failed:', error);
      }
    } finally {
      if (mountedRef.current && requestId === activeRequestRef.current) {
        setIsFetching(false);
      }
    }
  }, []);

  const onViewportChange = useCallback(
    (bbox: BBox) => {
      if (!isValidBBox(bbox)) {
        console.warn('[useCategorizedSpots] Ignoring invalid bbox:', bbox);
        return;
      }

      if (__DEV__) {
        console.log('Current BBox:', bboxToLogCoords(bbox));
        console.log('[useCategorizedSpots] BBox audit:', auditBBoxAgainstReference(bbox));
      }

      if (isDiscoveryBBoxTooLarge(bbox)) {
        setViewportBBox(bbox);
        setDisplayedCategories(EMPTY_CATEGORIES);
        setViewportMapSpots([]);
        return;
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setViewportBBox(bbox);
        void fetchCategoriesForBBox(bbox);
      }, VIEWPORT_DEBOUNCE_MS);
    },
    [fetchCategoriesForBBox]
  );

  // Immediate fetch on mount and when GPS/search center becomes available.
  useEffect(() => {
    mountedRef.current = true;
    const bbox = seedBboxForCenter(centerLat, centerLng);
    const seedKey = `${centerLat ?? 'none'},${centerLng ?? 'none'}`;

    if (centerSeedRef.current !== seedKey) {
      centerSeedRef.current = seedKey;
      setViewportBBox(bbox);
      void fetchCategoriesForBBox(bbox, { force: true });
    }

    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [centerLat, centerLng, fetchCategoriesForBBox]);

  const zoomedOutTooFar =
    viewportBBox != null && isDiscoveryBBoxTooLarge(viewportBBox);

  const mapSpots = zoomedOutTooFar ? [] : viewportMapSpots;

  const hasViewport = viewportBBox != null;
  const isLoading = isFetching && mapSpots.length === 0 && displayedCategories.length === 0;

  return {
    categories: displayedCategories,
    mapSpots,
    onViewportChange,
    isFetching,
    isLoading,
    zoomedOutTooFar,
    hasViewport,
    viewportBBox,
  };
}
