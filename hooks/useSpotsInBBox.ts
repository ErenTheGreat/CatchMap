import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fishingApi, BBox } from '@/lib/api/fishingApi';
import {
  bboxCacheKey,
  clampBBox,
  parseBboxCacheKey,
} from '@/lib/api/endpoints/spatialSpots';
import { STALE_TIME_MS } from '@/lib/queryClient';

const VIEWPORT_DEBOUNCE_MS = 500;

type SpotsBBoxQueryKey = readonly ['spotsBBox', string];

function isValidBBox(bbox: BBox): boolean {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return (
    [minLng, minLat, maxLng, maxLat].every(Number.isFinite) &&
    maxLng > minLng &&
    maxLat > minLat
  );
}

function isCancelledQueryError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'AbortError' ||
    error.name === 'CancelledError' ||
    /aborted|cancel/i.test(error.message)
  );
}

function shouldRetryViewportQuery(failureCount: number, error: unknown): boolean {
  if (isCancelledQueryError(error)) return false;
  if (error instanceof Error && /429|504|rate.?limit|timeout/i.test(error.message)) {
    return false;
  }
  return failureCount < 2;
}

function bboxFromQueryKey(queryKey: SpotsBBoxQueryKey): BBox {
  const [, cacheKey] = queryKey;
  const bbox = parseBboxCacheKey(cacheKey);
  if (!bbox) {
    throw new Error(`Invalid spotsBBox query key: ${cacheKey}`);
  }
  return bbox;
}

/**
 * Viewport-driven spatial query. The map reports visible bounds via
 * onViewportChange; the TanStack key is `${minLng},${minLat},${maxLng},${maxLat}`
 * and is parsed back to four floats before calling get_locations_in_bbox.
 */
export function useMapViewportSpots() {
  const [viewportBBox, setViewportBBox] = useState<BBox | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBBoxKeyRef = useRef<string | null>(null);

  const onViewportChange = useCallback((bbox: BBox) => {
    if (!isValidBBox(bbox)) return;

    const nextKey = bboxCacheKey(bbox);
    if (nextKey === lastBBoxKeyRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      lastBBoxKeyRef.current = nextKey;
      setViewportBBox(bbox);
    }, VIEWPORT_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const bboxKey = viewportBBox ? bboxCacheKey(viewportBBox) : null;

  const queryKey = ['spotsBBox', bboxKey ?? 'idle'] satisfies SpotsBBoxQueryKey;

  const query = useQuery({
    queryKey,
    queryFn: ({ signal, queryKey: firedQueryKey }) => {
      const [, cacheKey] = firedQueryKey as SpotsBBoxQueryKey;
      if (cacheKey === 'idle') return Promise.resolve([]);
      const bbox = clampBBox(bboxFromQueryKey(firedQueryKey as SpotsBBoxQueryKey));
      return fishingApi.getSpotsInBBox(bbox, signal);
    },
    enabled: bboxKey !== null,
    staleTime: STALE_TIME_MS,
    gcTime: 24 * 60 * 60 * 1000,
    retry: shouldRetryViewportQuery,
    placeholderData: (previous) => previous,
  });

  return {
    spots: query.data ?? [],
    onViewportChange,
    viewportBBox,
    isFetching: query.isFetching,
    isLoading: query.isLoading,
  };
}

/** @deprecated Prefer useMapViewportSpots — pass viewport bounds from the map, not GPS. */
export function useSpotsInBBox(bbox: BBox | null) {
  const bboxKey = bbox ? bboxCacheKey(bbox) : null;

  return useQuery({
    queryKey: ['spotsBBox', bboxKey ?? 'idle'] satisfies SpotsBBoxQueryKey,
    queryFn: ({ signal, queryKey }) => {
      const [, cacheKey] = queryKey as SpotsBBoxQueryKey;
      if (cacheKey === 'idle') return Promise.resolve([]);
      const parsed = clampBBox(bboxFromQueryKey(queryKey as SpotsBBoxQueryKey));
      return fishingApi.getSpotsInBBox(parsed, signal);
    },
    enabled: bboxKey !== null,
    staleTime: STALE_TIME_MS,
    gcTime: 24 * 60 * 60 * 1000,
    retry: shouldRetryViewportQuery,
  });
}
