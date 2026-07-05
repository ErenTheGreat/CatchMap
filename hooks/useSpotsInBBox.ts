import { useQuery } from '@tanstack/react-query';
import { fishingApi, BBox } from '@/lib/api/fishingApi';
import {
  snapBBoxToTileGrid,
  bboxCacheKey,
} from '@/lib/api/endpoints/spatialSpots';
import { STALE_TIME_MS } from '@/lib/queryClient';

/**
 * Spatial-tile query: the camera bbox is snapped to a 0.25° grid, so panning
 * within the same tile reuses the cache instead of refetching. Tiles are
 * persisted to AsyncStorage — revisiting a city renders instantly offline.
 */
export function useSpotsInBBox(bbox: BBox | null) {
  const snapped = bbox ? snapBBoxToTileGrid(bbox) : null;

  return useQuery({
    queryKey: ['spotsBBox', snapped ? bboxCacheKey(snapped) : 'none'],
    queryFn: ({ signal }) => fishingApi.getSpotsInBBox(snapped!, signal),
    enabled: snapped !== null,
    staleTime: STALE_TIME_MS,
    gcTime: 24 * 60 * 60 * 1000,
    placeholderData: (previous) => previous,
  });
}
