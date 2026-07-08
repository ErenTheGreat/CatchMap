import { useQuery } from '@tanstack/react-query';
import {
  DEFAULT_RADIUS_METERS,
  fetchLocalSpeciesNearPoint,
} from '@/lib/api/endpoints/localSpecies';
import type { LocalSpecies } from '@/lib/types/fishingEngine';
import { isNetworkError } from '@/lib/network/isNetworkError';
import { useNetworkStatus } from '@/providers/NetworkProvider';

export interface UseLocalFishingDataResult {
  species: LocalSpecies[];
  isLoading: boolean;
  isFetchingSpecies: boolean;
  isOffline: boolean;
  error: Error | null;
  refetchSpecies: () => void;
}

/**
 * Fetches species near arbitrary coordinates via the PostGIS RPC.
 * Re-runs automatically when latitude/longitude change (GPS or search selection).
 */
export function useLocalFishingData(
  latitude?: number | null,
  longitude?: number | null,
  radiusMeters: number = DEFAULT_RADIUS_METERS
): UseLocalFishingDataResult {
  const { isOffline: networkOffline } = useNetworkStatus();
  const hasCoords = latitude != null && longitude != null;

  const speciesQuery = useQuery({
    queryKey: ['localSpecies', latitude, longitude, radiusMeters],
    queryFn: ({ signal }) =>
      fetchLocalSpeciesNearPoint(latitude!, longitude!, radiusMeters, signal),
    enabled: hasCoords && !networkOffline,
    staleTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      if (isNetworkError(error)) return failureCount < 1;
      return failureCount < 2;
    },
  });

  const queryOffline = speciesQuery.isError && isNetworkError(speciesQuery.error);

  return {
    species: speciesQuery.data ?? [],
    isLoading: hasCoords && speciesQuery.isLoading,
    isFetchingSpecies: speciesQuery.isFetching,
    isOffline: networkOffline || queryOffline,
    error: speciesQuery.error instanceof Error ? speciesQuery.error : null,
    refetchSpecies: () => {
      void speciesQuery.refetch();
    },
  };
}
