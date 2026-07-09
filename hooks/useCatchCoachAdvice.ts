import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { isCatchCoachEnabled } from '@/constants/features';
import { useCatchInsights } from '@/hooks/useCatchInsights';
import { useCommunityCatchActivity } from '@/hooks/useCommunityCatchActivity';
import { fishingApi } from '@/lib/api/fishingApi';
import type {
  AvailableSpecies,
  CatchActivityRow,
  SpeciesPrediction,
} from '@/lib/types/speciesPrediction';
import type { CatchCoachAdvice } from '@/lib/types/catchCoach';
import type { BestTimeNowResult } from '@/utils/bestTimeNow';
import { getBestTimeNow } from '@/utils/bestTimeNow';
import { buildCatchCoachAdvice } from '@/utils/catchCoach';
import { buildLocationSpeciesGuide, findSpeciesCatalogEntry } from '@/utils/speciesGuide';
import { scoreSpeciesPredictions } from '@/lib/species/scoreSpeciesPrediction';
import type { NearbySpot } from '@/utils/recommendations';
import type { LocationSpeciesGuide } from '@/lib/types/speciesGuide';
import { useNetworkStatus } from '@/providers/NetworkProvider';

export interface CatchCoachContext {
  prediction?: SpeciesPrediction;
  bestTime?: BestTimeNowResult | null;
  communityRows?: CatchActivityRow[];
  guide?: LocationSpeciesGuide | null;
  spot?: NearbySpot | null;
}

export interface UseCatchCoachAdviceOptions {
  species: string;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  spotWaterType?: string | null;
  /** When provided (e.g. map modal), skip redundant fetches and use parent context. */
  context?: CatchCoachContext;
  enabled?: boolean;
}

function buildCoachSpot(
  latitude: number,
  longitude: number,
  locationName?: string | null,
  spotWaterType?: string | null,
  spot?: NearbySpot | null
): NearbySpot {
  if (spot) return spot;

  return {
    id: 'coach-location',
    name: locationName?.trim() || 'Your location',
    description: null,
    latitude,
    longitude,
    water_type: spotWaterType ?? 'lake',
    species: [],
    facilities: [],
    best_months: [],
    rating: 0,
    created_at: '',
    distance: 0,
    matchedSpecies: [],
    isPeakSeason: false,
  };
}

function buildAvailableSpeciesFromName(name: string): AvailableSpecies | null {
  const catalog = findSpeciesCatalogEntry(name);
  if (!catalog) return null;
  return {
    id: catalog.id,
    name: catalog.name,
    scientificName: catalog.scientificName,
    imageUrl: catalog.image,
    feedingZone: 'mid',
    idealTempMin: null,
    idealTempMax: null,
    monthStart: 1,
    monthEnd: 12,
    inCatalog: true,
    source: 'bundled',
  };
}

export function useCatchCoachAdvice({
  species,
  latitude,
  longitude,
  locationName,
  spotWaterType,
  context,
  enabled = true,
}: UseCatchCoachAdviceOptions) {
  const { isOffline } = useNetworkStatus();
  const { catches, getPersonalSpeciesNear } = useCatchInsights();

  const speciesEnabled = enabled && isCatchCoachEnabled() && !!species.trim();
  const hasCoords = latitude != null && longitude != null;
  const useExternalContext = !!context?.guide || !!context?.prediction;

  const personalSpecies = useMemo(() => {
    if (!hasCoords) return [];
    return getPersonalSpeciesNear(latitude!, longitude!);
  }, [hasCoords, latitude, longitude, getPersonalSpeciesNear]);

  const [availabilityQuery, weatherQuery, catchActivityQuery] = useQueries({
    queries: [
      {
        queryKey: [
          'catchCoachAvailability',
          latitude,
          longitude,
          locationName,
          spotWaterType,
        ],
        queryFn: ({ signal }) =>
          fishingApi.getSpeciesAvailabilityWithContext(
            null,
            latitude ?? null,
            longitude ?? null,
            new Date().getMonth() + 1,
            signal,
            locationName ?? null,
            spotWaterType ?? null,
            isOffline
          ),
        enabled: speciesEnabled && hasCoords && !useExternalContext,
        staleTime: 5 * 60 * 1000,
        retry: 1,
      },
      {
        queryKey: ['catchCoachWeather', latitude, longitude],
        queryFn: ({ signal }) => fishingApi.getWeather(latitude!, longitude!, signal),
        enabled: speciesEnabled && hasCoords && !context?.bestTime,
        staleTime: 15 * 60 * 1000,
        retry: 1,
      },
      {
        queryKey: ['catchCoachActivity', latitude, longitude],
        queryFn: ({ signal }) =>
          fishingApi.getCatchActivityNearPoint(latitude!, longitude!, 500, 90, signal),
        enabled:
          speciesEnabled && hasCoords && !context?.communityRows && !isOffline,
        staleTime: 5 * 60 * 1000,
        retry: 1,
      },
    ],
  });

  const { rows: fallbackCommunityRows } = useCommunityCatchActivity({
    latitude,
    longitude,
    enabled:
      speciesEnabled &&
      hasCoords &&
      !context?.communityRows &&
      !catchActivityQuery.data &&
      !isOffline,
  });

  const advice = useMemo((): CatchCoachAdvice | null => {
    if (!speciesEnabled) return null;

    const communityRows =
      context?.communityRows ??
      catchActivityQuery.data ??
      fallbackCommunityRows ??
      [];

    const weather = weatherQuery.data ?? null;
    const availability = availabilityQuery.data;
    const spotContext = availability?.spotContext ?? null;
    const speciesList = availability?.species ?? [];

    const scored =
      !useExternalContext && speciesList.length > 0
        ? scoreSpeciesPredictions({
            species: speciesList,
            weather,
            spotContext,
            latitude: latitude ?? null,
            longitude: longitude ?? null,
            catchActivity: communityRows,
            personalSpecies,
            tides: null,
            currentMonth: new Date().getMonth() + 1,
          })
        : null;

    const prediction =
      context?.prediction ??
      scored?.predictions.find((item) =>
        item.name.toLowerCase().includes(species.toLowerCase()) ||
        species.toLowerCase().includes(item.name.toLowerCase())
      );

    const bestTime =
      context?.bestTime ??
      (hasCoords
        ? getBestTimeNow({
            latitude,
            longitude,
            weather,
            spotSpecies: scored?.predictions,
            communityCatchActivity: communityRows,
          })
        : null);

    const guide =
      context?.guide ??
      (hasCoords && (prediction || speciesList.length > 0)
        ? buildLocationSpeciesGuide({
            species:
              prediction ??
              speciesList.find((item) =>
                item.name.toLowerCase().includes(species.toLowerCase())
              ) ??
              speciesList[0] ??
              buildAvailableSpeciesFromName(species) ?? {
                id: species,
                name: species,
                scientificName: species,
                imageUrl: null,
                feedingZone: 'mid',
                idealTempMin: null,
                idealTempMax: null,
                monthStart: 1,
                monthEnd: 12,
                inCatalog: false,
                source: 'bundled',
              },
            prediction,
            spot: buildCoachSpot(
              latitude!,
              longitude!,
              locationName,
              spotWaterType,
              context?.spot ?? null
            ),
          })
        : null);

    return buildCatchCoachAdvice({
      speciesName: species,
      guide,
      prediction,
      bestTime,
      communityRows,
      catches,
      latitude,
      longitude,
    });
  }, [
    speciesEnabled,
    species,
    context,
    useExternalContext,
    catchActivityQuery.data,
    fallbackCommunityRows,
    weatherQuery.data,
    availabilityQuery.data,
    personalSpecies,
    catches,
    latitude,
    longitude,
    locationName,
    spotWaterType,
    hasCoords,
  ]);

  const isLoading =
    speciesEnabled &&
    hasCoords &&
    !useExternalContext &&
    (availabilityQuery.isLoading ||
      weatherQuery.isLoading ||
      catchActivityQuery.isLoading);

  return {
    advice,
    isLoading,
    isEnabled: speciesEnabled,
  };
}
