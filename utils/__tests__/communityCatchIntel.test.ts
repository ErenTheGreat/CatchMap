import { describe, expect, it } from 'vitest';
import {
  computeCommunityActivityBoost,
  getCommunityCatchTotal,
  getCommunityTopLures,
  summarizeCommunityCatchActivity,
} from '@/utils/communityCatchIntel';

describe('communityCatchIntel', () => {
  const sampleRows = [
    {
      speciesId: '1',
      speciesName: 'Largemouth Bass',
      catchCount: 8,
      topLures: ['Spinnerbait', 'Senko'],
    },
    {
      speciesId: '2',
      speciesName: 'Rainbow Trout',
      catchCount: 3,
      topLures: ['Spinnerbait', 'Crankbait'],
    },
  ];

  it('sums total community catches', () => {
    expect(getCommunityCatchTotal(sampleRows)).toBe(11);
  });

  it('ranks lures by weighted catch count', () => {
    expect(getCommunityTopLures(sampleRows, 3)).toEqual(['Spinnerbait', 'Senko', 'Crankbait']);
  });

  it('returns zero boost when no community data exists', () => {
    expect(computeCommunityActivityBoost([])).toBe(0);
  });

  it('returns a capped positive boost for active areas', () => {
    const boost = computeCommunityActivityBoost(sampleRows);
    expect(boost).toBeGreaterThan(0);
    expect(boost).toBeLessThanOrEqual(0.8);
  });

  it('builds a display summary for map intel cards', () => {
    const summary = summarizeCommunityCatchActivity(sampleRows);
    expect(summary.totalCatches).toBe(11);
    expect(summary.speciesBreakdown[0]?.speciesName).toBe('Largemouth Bass');
    expect(summary.topLures[0]).toBe('Spinnerbait');
    expect(summary.daysBack).toBe(90);
  });
});
