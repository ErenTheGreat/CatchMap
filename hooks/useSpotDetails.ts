import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchSpotDetails } from '@/lib/api/endpoints/spotDetails';
import type { SpotDetails } from '@/lib/types/spotDetails';

interface UseSpotDetailsOptions {
  spotId: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function useSpotDetails({ spotId, latitude, longitude }: UseSpotDetailsOptions) {
  const hasCoords = latitude != null && longitude != null;

  return useQuery<SpotDetails>({
    queryKey: ['spotDetails', spotId, latitude, longitude],
    queryFn: ({ signal }) =>
      fetchSpotDetails(latitude!, longitude!, spotId!, signal),
    enabled: !!spotId && hasCoords,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
