import { useQuery } from '@tanstack/react-query';
import { fetchAccessPointsInBBox } from '@/lib/api/endpoints/accessPoints';
import type { BBox } from '@/lib/api/endpoints/spatialSpots';
import { bboxCacheKey, snapBBoxToTileGrid } from '@/lib/api/endpoints/spatialSpots';
import type { NearbySpot } from '@/utils/osmFishingSpots';
import { useNetworkStatus } from '@/providers/NetworkProvider';

interface UseAccessPointsOptions {
  bbox: BBox | null;
  centerLat?: number;
  centerLng?: number;
  enabled?: boolean;
}

export function useAccessPoints({
  bbox,
  centerLat,
  centerLng,
  enabled = true,
}: UseAccessPointsOptions) {
  const { isOffline } = useNetworkStatus();
  const hasCenter = centerLat != null && centerLng != null;
  const snapped = bbox ? snapBBoxToTileGrid(bbox) : null;
  const cacheKey = snapped ? bboxCacheKey(snapped) : 'none';

  const query = useQuery({
    queryKey: ['accessPoints', cacheKey, centerLat, centerLng],
    queryFn: ({ signal }) =>
      fetchAccessPointsInBBox(snapped!, centerLat!, centerLng!, signal),
    enabled: enabled && !isOffline && snapped != null && hasCenter,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  return {
    accessPoints: (query.data ?? []) as NearbySpot[],
    isLoading: query.isLoading,
  };
}
