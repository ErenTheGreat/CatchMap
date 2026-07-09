import { useEffect, useMemo, useRef, useState } from 'react';
import { fishingApi } from '@/lib/api/fishingApi';
import { scoreSpeciesPredictions } from '@/lib/species/scoreSpeciesPrediction';
import { prefetchSpotData } from '@/lib/species/prefetchSpotData';
import type { TidePrediction } from '@/lib/api/endpoints/tides';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import type { CatchActivityRow, SpeciesPrediction } from '@/lib/types/speciesPrediction';
import { queryClient } from '@/lib/queryClient';
import type { NearbySpot } from '@/utils/osmFishingSpots';
import { useViewportCommunityActivity } from '@/hooks/useViewportCommunityActivity';
import {
  buildScoresBySpotId,
  ENRICHMENT_TOP_N,
  getHourBucket,
  isSaltwaterSpot,
  rankDiscoverySpots,
  scoreSpotsForDiscovery,
  TOP_SPOTS_DISPLAY,
  type RankedDiscoverySpot,
  type SpotDiscoveryScore,
} from '@/utils/spotDiscoveryScore';

interface UseViewportSpotScoresOptions {
  spots: NearbySpot[];
  weather?: WeatherSnapshot | null;
  tides?: TidePrediction[] | null;
  enabled?: boolean;
  personalBoost?: number;
}

const EMPTY_SCORES: Record<string, SpotDiscoveryScore> = {};
const ENRICH_DEBOUNCE_MS = 3000;

/** Coarse weather fingerprint — avoids tier reshuffles from minor polling deltas. */
export function buildWeatherBucket(weather?: WeatherSnapshot | null): string {
  if (!weather) return 'none';
  const pressure = Math.round(weather.pressureMb ?? 0);
  const wind = Math.round(weather.windSpeedMph ?? 0);
  const temp = Math.round(weather.temperatureF ?? 0);
  const precip = weather.precipitationInch > 0 ? 1 : 0;
  return `${pressure}:${wind}:${temp}:${precip}:${weather.pressureTrend ?? 'u'}`;
}

async function enrichTopSpots(
  topSpots: RankedDiscoverySpot[],
  weather: WeatherSnapshot | null | undefined,
  tides: TidePrediction[] | null | undefined,
  signal?: AbortSignal
): Promise<Map<string, SpeciesPrediction[]>> {
  const enriched = new Map<string, SpeciesPrediction[]>();
  const currentMonth = new Date().getMonth() + 1;

  await Promise.all(
    topSpots.map(async ({ spot }) => {
      if (signal?.aborted) return;
      try {
        const [availability, weatherData, catchActivity] = await Promise.all([
          fishingApi.getSpeciesAvailabilityWithContext(
            spot.id,
            spot.latitude,
            spot.longitude,
            currentMonth,
            signal,
            spot.name,
            spot.water_type
          ),
          weather
            ? Promise.resolve(weather)
            : fishingApi.getWeather(spot.latitude, spot.longitude, signal),
          fishingApi
            .getCatchActivityNearPoint(spot.latitude, spot.longitude, 500, 90, signal)
            .catch(() => []),
        ]);

        const scored = scoreSpeciesPredictions({
          species: availability.species,
          weather: weatherData,
          spotContext: availability.spotContext,
          latitude: spot.latitude,
          longitude: spot.longitude,
          catchActivity,
          personalSpecies: [],
          tides: isSaltwaterSpot(spot.water_type) ? (tides ?? null) : null,
          currentMonth,
        });

        if (scored.predictions.length > 0) {
          enriched.set(spot.id, scored.predictions);
        }
      } catch (error) {
        if (__DEV__) console.warn('[spotScores] enrichment failed for spot:', spot.id, error);
        // Keep fast-path score when enrichment fails.
      }
    })
  );

  return enriched;
}

function buildSpotKey(spots: NearbySpot[]): string {
  return [...spots]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((spot) => spot.id)
    .join(',');
}

function scoresEqual(
  left: Record<string, SpotDiscoveryScore>,
  right: Record<string, SpotDiscoveryScore>
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  for (const key of leftKeys) {
    const leftScore = left[key];
    const rightScore = right[key];
    if (leftScore?.activityRating !== rightScore?.activityRating) return false;
    if (leftScore?.rawScore !== rightScore?.rawScore) return false;
    if (leftScore?.enriched !== rightScore?.enriched) return false;
    if (leftScore?.topSpeciesHint !== rightScore?.topSpeciesHint) return false;
    if (leftScore?.communityCatchCount !== rightScore?.communityCatchCount) return false;
  }
  return true;
}

export function useViewportSpotScores({
  spots,
  weather,
  tides,
  enabled = true,
  personalBoost = 0,
}: UseViewportSpotScoresOptions) {
  const hourBucket = getHourBucket();
  const spotKey = useMemo(() => buildSpotKey(spots), [spots]);
  const weatherBucket = useMemo(() => buildWeatherBucket(weather), [weather]);
  const stableScoresRef = useRef(EMPTY_SCORES);
  const enrichedBySpotIdRef = useRef<Map<string, SpeciesPrediction[]>>(new Map());
  const enrichRequestRef = useRef(0);
  const [enrichedScoresVersion, setEnrichedScoresVersion] = useState(0);
  const [enrichedTopSpots, setEnrichedTopSpots] = useState<RankedDiscoverySpot[]>([]);
  const [isEnriching, setIsEnriching] = useState(false);
  const { communityBySpotId, isLoading: isCommunityLoading } = useViewportCommunityActivity({
    spots,
    enabled,
  });

  useEffect(() => {
    enrichedBySpotIdRef.current = new Map();
    setEnrichedScoresVersion((version) => version + 1);
    setEnrichedTopSpots([]);
  }, [hourBucket]);

  const scoresBySpotId = useMemo(() => {
    if (!enabled || spots.length === 0) {
      stableScoresRef.current = EMPTY_SCORES;
      return EMPTY_SCORES;
    }

    const enrichment =
      enrichedBySpotIdRef.current.size > 0 ? enrichedBySpotIdRef.current : undefined;
    const scores = scoreSpotsForDiscovery(
      spots,
      { weather, tides, personalBoost },
      enrichment,
      communityBySpotId
    );
    const next = buildScoresBySpotId(scores);

    if (scoresEqual(stableScoresRef.current, next)) {
      return stableScoresRef.current;
    }

    stableScoresRef.current = next;
    return next;
  }, [
    enabled,
    spots,
    spotKey,
    hourBucket,
    weatherBucket,
    tides,
    communityBySpotId,
    personalBoost,
    enrichedScoresVersion,
  ]);

  useEffect(() => {
    if (!enabled || spots.length === 0) return;

    const requestId = ++enrichRequestRef.current;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      const ranked = rankDiscoverySpots(spots, stableScoresRef.current).slice(0, ENRICHMENT_TOP_N);

      for (const { spot } of ranked) {
        prefetchSpotData(queryClient, spot);
      }

      setIsEnriching(true);

      void enrichTopSpots(ranked, weather, tides, controller.signal)
        .then((enrichedBySpotId) => {
          if (controller.signal.aborted || enrichRequestRef.current !== requestId) return;
          if (enrichedBySpotId.size === 0) return;

          enrichedBySpotIdRef.current = enrichedBySpotId;
          setEnrichedScoresVersion((version) => version + 1);

          const syncScores = buildScoresBySpotId(
            scoreSpotsForDiscovery(
              spots,
              { weather, tides, personalBoost },
              enrichedBySpotId,
              communityBySpotId
            )
          );
          const hintedTop = ranked.map(({ spot, score, rank }) => {
            const predictions = enrichedBySpotId.get(spot.id);
            const topSpecies = predictions?.[0];
            if (!topSpecies) {
              return { spot, score: syncScores[spot.id] ?? score, rank };
            }

            return {
              spot,
              score: {
                ...(syncScores[spot.id] ?? score),
                topSpeciesHint: topSpecies.name,
                topSpeciesProbability: topSpecies.probability,
                enriched: true,
              },
              rank,
            };
          });

          setEnrichedTopSpots(hintedTop);
        })
        .finally(() => {
          if (enrichRequestRef.current === requestId) {
            setIsEnriching(false);
          }
        });
    }, ENRICH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [enabled, spotKey, hourBucket, weatherBucket, tides, spots, communityBySpotId, personalBoost, weather]);

  const topSpots = useMemo(() => {
    if (enrichedTopSpots.length > 0) return enrichedTopSpots;
    return rankDiscoverySpots(spots, scoresBySpotId).slice(0, TOP_SPOTS_DISPLAY);
  }, [enrichedTopSpots, spots, scoresBySpotId]);

  return {
    scoresBySpotId,
    topSpots,
    isScoring: isCommunityLoading,
    isEnriching,
    communityBySpotId,
  };
}
