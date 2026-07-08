import type { QueryClient } from '@tanstack/react-query';
import { fishingApi } from '@/lib/api/fishingApi';
import { fetchSpotDetails } from '@/lib/api/endpoints/spotDetails';
import type { NearbySpot } from '@/utils/osmFishingSpots';

const SPECIES_STALE_MS = 5 * 60 * 1000;
const SPOT_DETAILS_STALE_MS = 5 * 60 * 1000;

export function prefetchSpotData(queryClient: QueryClient, spot: NearbySpot): void {
  const currentMonth = new Date().getMonth() + 1;

  void queryClient.prefetchQuery({
    queryKey: [
      'speciesAvailability',
      'v4',
      spot.id,
      spot.latitude,
      spot.longitude,
      spot.name,
      currentMonth,
    ],
    queryFn: ({ signal }) =>
      fishingApi.getSpeciesAvailabilityWithContext(
        spot.id,
        spot.latitude,
        spot.longitude,
        currentMonth,
        signal,
        spot.name
      ),
    staleTime: SPECIES_STALE_MS,
  });

  void queryClient.prefetchQuery({
    queryKey: ['spotDetails', spot.id, spot.latitude, spot.longitude],
    queryFn: ({ signal }) =>
      fetchSpotDetails(spot.latitude, spot.longitude, spot.id, signal),
    staleTime: SPOT_DETAILS_STALE_MS,
  });

  void queryClient.prefetchQuery({
    queryKey: ['weather', spot.latitude, spot.longitude],
    queryFn: ({ signal }) => fishingApi.getWeather(spot.latitude, spot.longitude, signal),
    staleTime: 15 * 60 * 1000,
  });
}
