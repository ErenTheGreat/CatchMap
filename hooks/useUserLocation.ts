import { useQuery } from '@tanstack/react-query';
import { getCurrentLocation, UserLocation } from '@/utils/location';

const DEFAULT_LOCATION: UserLocation = { latitude: 45.5231, longitude: -122.6765 };

export function useUserLocation() {
  return useQuery({
    queryKey: ['userLocation'],
    queryFn: async () => {
      let location = null;
      try {
        location = await getCurrentLocation();
      } catch {
        // Geolocation denied/unavailable (common on web) — use the default
      }
      return {
        location: location ?? DEFAULT_LOCATION,
        isDefault: !location,
      };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
