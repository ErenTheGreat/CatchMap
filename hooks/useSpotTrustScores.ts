import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SavedSpotSnapshot } from '@/lib/types/savedSpot';
import { loadTripFeedbackRecords } from '@/utils/tripFeedback';
import {
  buildSpotTrustBySpotId,
  buildTrustBoostBySpotId,
  type SpotTrustResult,
} from '@/utils/spotTrustScore';

export function useSpotTrustScores(savedSpots: SavedSpotSnapshot[]) {
  const [trustBySpotId, setTrustBySpotId] = useState<Record<string, SpotTrustResult>>({});
  const [trustBoostBySpotId, setTrustBoostBySpotId] = useState<Record<string, number>>({});

  const spotKey = useMemo(
    () => savedSpots.map((spot) => spot.id).join(','),
    [savedSpots]
  );

  const refresh = useCallback(async () => {
    const records = await loadTripFeedbackRecords();
    setTrustBySpotId(buildSpotTrustBySpotId(savedSpots, records));
    setTrustBoostBySpotId(buildTrustBoostBySpotId(savedSpots, records));
  }, [savedSpots]);

  useEffect(() => {
    void refresh();
  }, [refresh, spotKey]);

  return { trustBySpotId, trustBoostBySpotId, refresh };
}
