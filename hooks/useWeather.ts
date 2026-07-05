import { useQuery } from '@tanstack/react-query';
import { fishingApi } from '@/lib/api/fishingApi';

export function useWeather(latitude?: number | null, longitude?: number | null) {
  const hasCoords = latitude != null && longitude != null;

  return useQuery({
    queryKey: ['weather', latitude, longitude],
    queryFn: ({ signal }) => fishingApi.getWeather(latitude!, longitude!, signal),
    enabled: hasCoords,
    staleTime: 15 * 60 * 1000,
  });
}
