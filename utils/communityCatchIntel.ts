import type { CatchActivityRow } from '@/lib/types/speciesPrediction';

const COMMUNITY_INTEL_DAYS = 90;

export interface CommunityCatchSummary {
  totalCatches: number;
  speciesBreakdown: Array<{ speciesName: string; catchCount: number }>;
  topLures: string[];
  daysBack: number;
}

/** Total opt-in catches aggregated near a point. */
export function getCommunityCatchTotal(rows: CatchActivityRow[]): number {
  return rows.reduce((sum, row) => sum + row.catchCount, 0);
}

/** Rank lures by weighted catch count across species rows. */
export function getCommunityTopLures(rows: CatchActivityRow[], limit = 3): string[] {
  const lureWeights = new Map<string, number>();

  for (const row of rows) {
    for (const lure of row.topLures) {
      const normalized = lure?.trim();
      if (!normalized) continue;
      lureWeights.set(normalized, (lureWeights.get(normalized) ?? 0) + row.catchCount);
    }
  }

  return [...lureWeights.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([lure]) => lure);
}

/** Bite-score boost from anonymized community catch volume (log-scaled, capped). */
export function computeCommunityActivityBoost(rows: CatchActivityRow[]): number {
  const total = getCommunityCatchTotal(rows);
  if (total <= 0) return 0;
  return Math.min(0.8, Math.log10(total + 1) * 0.35);
}

export function summarizeCommunityCatchActivity(
  rows: CatchActivityRow[],
  daysBack = COMMUNITY_INTEL_DAYS
): CommunityCatchSummary {
  const speciesBreakdown = [...rows]
    .filter((row) => row.catchCount > 0)
    .sort((left, right) => right.catchCount - left.catchCount)
    .map((row) => ({
      speciesName: row.speciesName,
      catchCount: row.catchCount,
    }));

  return {
    totalCatches: getCommunityCatchTotal(rows),
    speciesBreakdown,
    topLures: getCommunityTopLures(rows, 3),
    daysBack,
  };
}
