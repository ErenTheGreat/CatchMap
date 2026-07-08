import { keepPreviousData, useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fishingApi } from '@/lib/api/fishingApi';
import { scoreSpeciesPredictions } from '@/lib/species/scoreSpeciesPrediction';
import {
  type AvailableSpecies,
  type SpeciesPredictionResult,
} from '@/lib/types/speciesPrediction';
import { resolvePostgisLocationUuid } from '@/lib/api/bundledLocationIds';
import type { PersonalSpeciesNear } from '@/lib/types/catchInsights';
import type { TidePrediction } from '@/lib/api/endpoints/tides';
import { useNetworkStatus } from '@/providers/NetworkProvider';

interface UseSpeciesPredictionOptions {
  locationId: string | null;
  latitude?: number | null;
  longitude?: number | null;
  spotName?: string | null;
  personalSpecies?: PersonalSpeciesNear[];
  tidesPredictions?: TidePrediction[] | null;
}

const EMPTY_RESULT: SpeciesPredictionResult & { species: AvailableSpecies[] } = {
  species: [],
  predictions: [],
  skyCondition: null,
  temperatureF: null,
  spotContext: null,
  contextSubtitle: null,
};

export function useSpeciesPrediction({
  locationId,
  latitude,
  longitude,
  spotName = null,
  personalSpecies = [],
  tidesPredictions = null,
}: UseSpeciesPredictionOptions) {
  const { isOffline: networkOffline } = useNetworkStatus();
  const hasCoords = latitude != null && longitude != null;
  const parsedLocationId = resolvePostgisLocationUuid(locationId);
  const currentMonth = new Date().getMonth() + 1;
  const enabled = !!parsedLocationId || hasCoords;

  const [availabilityQuery, weatherQuery, catchActivityQuery] = useQueries({
    queries: [
      {
        queryKey: [
          'speciesAvailability',
          'v4',
          locationId,
          latitude,
          longitude,
          spotName,
          currentMonth,
        ],
        queryFn: ({ signal }) =>
          fishingApi.getSpeciesAvailabilityWithContext(
            locationId,
            latitude ?? null,
            longitude ?? null,
            currentMonth,
            signal,
            spotName
          ),
        enabled,
        staleTime: 5 * 60 * 1000,
        retry: 1,
        placeholderData: keepPreviousData,
        networkMode: 'offlineFirst',
      },
      {
        queryKey: ['weather', latitude, longitude],
        queryFn: ({ signal }) => fishingApi.getWeather(latitude!, longitude!, signal),
        enabled: hasCoords,
        staleTime: 15 * 60 * 1000,
        retry: 1,
        placeholderData: keepPreviousData,
        networkMode: 'offlineFirst',
      },
      {
        queryKey: ['catchActivity', latitude, longitude],
        queryFn: ({ signal }) =>
          fishingApi.getCatchActivityNearPoint(latitude!, longitude!, 500, 90, signal),
        enabled: hasCoords && !networkOffline,
        staleTime: 5 * 60 * 1000,
        retry: 1,
        placeholderData: keepPreviousData,
        networkMode: 'offlineFirst',
      },
    ],
  });

  const spotContext = availabilityQuery.data?.spotContext ?? null;
  const fetchTidesForSaltwater = spotContext?.isSaltwater ?? false;
  const species = availabilityQuery.data?.species ?? [];
  const hasSpeciesList = species.length > 0;

  const data = useMemo(() => {
    if (!enabled) {
      return EMPTY_RESULT;
    }

    const tidesData = fetchTidesForSaltwater ? tidesPredictions : null;

    const scored = scoreSpeciesPredictions({
      species,
      weather: weatherQuery.data,
      spotContext,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      catchActivity: catchActivityQuery.data ?? [],
      personalSpecies,
      tides: tidesData ?? null,
      currentMonth,
    });

    return {
      species,
      ...scored,
    };
  }, [
    enabled,
    species,
    weatherQuery.data,
    catchActivityQuery.data,
    fetchTidesForSaltwater,
    tidesPredictions,
    spotContext,
    latitude,
    longitude,
    personalSpecies,
    currentMonth,
  ]);

  const isLoadingSpecies =
    enabled &&
    !availabilityQuery.data &&
    (availabilityQuery.isLoading || availabilityQuery.isFetching);

  const isUpdatingSpecies =
    enabled &&
    availabilityQuery.isFetching &&
    availabilityQuery.isPlaceholderData;

  const isUpdatingScores =
    hasSpeciesList &&
    hasCoords &&
    ((weatherQuery.isFetching && !weatherQuery.isLoading) ||
      (catchActivityQuery.isFetching && !catchActivityQuery.isLoading));

  return {
    data,
    isLoading: isLoadingSpecies,
    isUpdating: isUpdatingSpecies || isUpdatingScores,
    isError: availabilityQuery.isError,
    refetch: () => {
      void availabilityQuery.refetch();
      void weatherQuery.refetch();
      void catchActivityQuery.refetch();
    },
  };
}
