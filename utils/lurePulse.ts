import type { CatchActivityRow } from '@/lib/types/speciesPrediction';
import { getCommunityTopLures } from '@/utils/communityCatchIntel';

export interface TrendingLure {
  lure: string;
  catchWeight: number;
  spotCount: number;
  topSpotName: string | null;
}

export interface LurePulseSummary {
  trending: TrendingLure[];
  radiusLabel: string;
  daysBack: number;
}

const DEFAULT_LIMIT = 5;

export function aggregateTrendingLures(
  communityBySpotId: Record<string, CatchActivityRow[]>,
  spotNamesById: Record<string, string> = {},
  limit = DEFAULT_LIMIT
): LurePulseSummary {
  const lureWeights = new Map<string, { weight: number; spots: Set<string> }>();

  for (const [spotId, rows] of Object.entries(communityBySpotId)) {
    if (rows.length === 0) continue;
    const topLures = getCommunityTopLures(rows, 5);
    const spotWeight = rows.reduce((sum, row) => sum + row.catchCount, 0);

    for (const lure of topLures) {
      const entry = lureWeights.get(lure) ?? { weight: 0, spots: new Set<string>() };
      entry.weight += spotWeight;
      entry.spots.add(spotId);
      lureWeights.set(lure, entry);
    }
  }

  const trending = [...lureWeights.entries()]
    .map(([lure, meta]) => {
      const spotIds = [...meta.spots];
      const topSpotId = spotIds[0] ?? null;
      return {
        lure,
        catchWeight: meta.weight,
        spotCount: meta.spots.size,
        topSpotName: topSpotId ? spotNamesById[topSpotId] ?? null : null,
      };
    })
    .sort((left, right) => {
      const diff = right.catchWeight - left.catchWeight;
      if (diff !== 0) return diff;
      return right.spotCount - left.spotCount;
    })
    .slice(0, limit);

  return {
    trending,
    radiusLabel: 'within view',
    daysBack: 90,
  };
}
