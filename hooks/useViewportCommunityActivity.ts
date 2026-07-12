import { useEffect, useMemo, useRef, useState } from 'react';
import { fishingApi } from '@/lib/api/fishingApi';
import type { CatchActivityRow } from '@/lib/types/speciesPrediction';
import type { NearbySpot } from '@/utils/osmFishingSpots';
import { MAX_DISCOVERY_SPOTS } from '@/utils/spotDiscoveryScore';
import { useNetworkStatus } from '@/providers/NetworkProvider';

const FETCH_DEBOUNCE_MS = 3000;
const COMMUNITY_RADIUS_METERS = 500;
const COMMUNITY_DAYS_BACK = 90;

function buildSpotKey(spots: NearbySpot[]): string {
  return [...spots]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((spot) => spot.id)
    .join(',');
}

async function fetchCommunityActivityForSpots(
  spots: NearbySpot[],
  signal?: AbortSignal
): Promise<Record<string, CatchActivityRow[]>> {
  const capped = [...spots]
    .sort((left, right) => left.distance - right.distance)
    .slice(0, MAX_DISCOVERY_SPOTS);

  const entries = await Promise.all(
    capped.map(async (spot) => {
      try {
        const rows = await fishingApi.getCatchActivityNearPoint(
          spot.latitude,
          spot.longitude,
          COMMUNITY_RADIUS_METERS,
          COMMUNITY_DAYS_BACK,
          signal
        );
        return [spot.id, rows] as const;
      } catch {
        return [spot.id, []] as const;
      }
    })
  );

  const bySpotId: Record<string, CatchActivityRow[]> = {};
  for (const [spotId, rows] of entries) {
    bySpotId[spotId] = [...rows];
  }
  return bySpotId;
}

interface UseViewportCommunityActivityOptions {
  spots: NearbySpot[];
  enabled?: boolean;
}

export function useViewportCommunityActivity({
  spots,
  enabled = true,
}: UseViewportCommunityActivityOptions) {
  const { isOffline } = useNetworkStatus();
  const spotKey = useMemo(() => buildSpotKey(spots), [spots]);
  const requestRef = useRef(0);
  const [communityBySpotId, setCommunityBySpotId] = useState<
    Record<string, CatchActivityRow[]>
  >({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled || spots.length === 0 || isOffline) {
      setCommunityBySpotId({});
      setIsLoading(false);
      return;
    }

    const requestId = ++requestRef.current;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setIsLoading(true);
      void fetchCommunityActivityForSpots(spots, controller.signal)
        .then((next) => {
          if (controller.signal.aborted || requestRef.current !== requestId) return;
          setCommunityBySpotId(next);
        })
        .finally(() => {
          if (requestRef.current === requestId) {
            setIsLoading(false);
          }
        });
    }, FETCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [enabled, isOffline, spotKey, spots]);

  return {
    communityBySpotId,
    isLoading,
  };
}
