import { useQuery } from '@tanstack/react-query';
import { fishingApi } from '@/lib/api/fishingApi';

export function useTides(latitude?: number | null, longitude?: number | null) {
  const hasCoords = latitude != null && longitude != null;

  return useQuery({
    queryKey: ['tides', latitude, longitude],
    queryFn: ({ signal }) => fishingApi.getTides(latitude!, longitude!, signal),
    enabled: hasCoords,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
}
