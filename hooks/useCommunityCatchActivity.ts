import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fishingApi } from '@/lib/api/fishingApi';
import { summarizeCommunityCatchActivity } from '@/utils/communityCatchIntel';
import { useNetworkStatus } from '@/providers/NetworkProvider';

interface UseCommunityCatchActivityOptions {
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number;
  daysBack?: number;
  enabled?: boolean;
}

export function useCommunityCatchActivity({
  latitude,
  longitude,
  radiusMeters = 500,
  daysBack = 90,
  enabled = true,
}: UseCommunityCatchActivityOptions) {
  const { isOffline } = useNetworkStatus();
  const hasCoords = latitude != null && longitude != null;

  const query = useQuery({
    queryKey: ['catchActivity', latitude, longitude, radiusMeters, daysBack],
    queryFn: ({ signal }) =>
      fishingApi.getCatchActivityNearPoint(
        latitude!,
        longitude!,
        radiusMeters,
        daysBack,
        signal
      ),
    enabled: enabled && hasCoords && !isOffline,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
    networkMode: 'offlineFirst',
  });

  const summary = summarizeCommunityCatchActivity(query.data ?? [], daysBack);

  return {
    rows: query.data ?? [],
    summary,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}
