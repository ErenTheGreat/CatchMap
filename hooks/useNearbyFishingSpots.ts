import { useQuery } from '@tanstack/react-query';
import { fishingApi } from '@/lib/api/fishingApi';
import { STALE_TIME_MS } from '@/lib/queryClient';

interface UseNearbyFishingSpotsOptions {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  radiusMiles?: number;
  enabled?: boolean;
}

export function useNearbyFishingSpots({
  latitude,
  longitude,
  radiusMiles = 50,
  enabled = true,
}: UseNearbyFishingSpotsOptions) {
  const hasCoords = latitude != null && longitude != null;

  return useQuery({
    // v2: includes curated local dataset — bump invalidates stale persisted caches
    queryKey: ['nearbyFishingSpots', 'v2', latitude, longitude, radiusMiles],
    queryFn: ({ signal }) =>
      fishingApi.getNearbySpots({
        latitude: latitude!,
        longitude: longitude!,
        radiusMiles,
        signal,
      }),
    enabled: enabled && hasCoords,
    staleTime: STALE_TIME_MS,
    placeholderData: (previous) => previous,
  });
}
