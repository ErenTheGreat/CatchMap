import { describe, expect, it } from 'vitest';
import type { CatchActivityRow } from '@/lib/types/speciesPrediction';
import { aggregateTrendingLures } from '@/utils/lurePulse';

describe('lurePulse', () => {
  it('aggregates top lures across spots', () => {
    const rows: CatchActivityRow[] = [
      {
        speciesId: 'bass',
        speciesName: 'Bass',
        catchCount: 5,
        topLures: ['Senko', 'Spinnerbait'],
      },
    ];
    const summary = aggregateTrendingLures(
      { spotA: rows, spotB: rows },
      { spotA: 'Lake A', spotB: 'Lake B' }
    );
    expect(summary.trending.length).toBeGreaterThan(0);
    expect(summary.trending[0].lure).toBeTruthy();
  });

  it('returns empty when no community data', () => {
    const summary = aggregateTrendingLures({});
    expect(summary.trending).toEqual([]);
  });
});
