import { describe, expect, it } from 'vitest';
import type { TodaySpeciesTarget } from '@/utils/rankTodaySpeciesTargets';
import { computeFishTodayVerdict } from '@/utils/fishTodayVerdict';

function makeTarget(overrides: Partial<TodaySpeciesTarget>): TodaySpeciesTarget {
  return {
    speciesId: 'bass',
    speciesName: 'Largemouth Bass',
    matchScore: 70,
    probability: 72,
    activityRating: 'High',
    bestSpot: {
      id: 'a',
      name: 'Lake Alpha',
      description: null,
      latitude: 40,
      longitude: -74,
      water_type: 'lake',
      species: [],
      facilities: [],
      best_months: [6, 7],
      rating: 4,
      created_at: '2026-01-01T00:00:00.000Z',
      distance: 2,
      matchedSpecies: [],
      isPeakSeason: false,
    },
    bestSpotBiteRating: 5,
    bestSpotBiteLabel: 'Hot',
    factors: [],
    dataConfidence: 'high',
    rigLabel: 'Senko',
    rigTypeLabel: 'SPIN',
    personalMatch: false,
    supportingSpotCount: 1,
    bestWindow: null,
    goNowLabel: '',
    ...overrides,
  };
}

describe('computeFishTodayVerdict', () => {
  it('returns marginal when no targets', () => {
    const result = computeFishTodayVerdict([]);
    expect(result.verdict).toBe('marginal');
  });

  it('returns go_now when match is high and window is active', () => {
    const now = new Date('2026-07-11T14:00:00');
    const result = computeFishTodayVerdict(
      [
        makeTarget({
          matchScore: 78,
          goNowLabel: 'Go now — bite window active',
          bestWindow: {
            startTime: new Date('2026-07-11T13:00:00'),
            endTime: new Date('2026-07-11T16:00:00'),
            peakRating: 5,
            peakLabel: 'Hot',
            period: 'Afternoon',
            hourCount: 3,
          },
        }),
      ],
      now
    );
    expect(result.verdict).toBe('go_now');
    expect(result.headline).toBe('GO NOW');
  });

  it('returns wait when best window is later today', () => {
    const now = new Date('2026-07-11T10:00:00');
    const result = computeFishTodayVerdict(
      [
        makeTarget({
          matchScore: 60,
          goNowLabel: 'Best window: 5:00 PM – 8:00 PM',
          bestWindow: {
            startTime: new Date('2026-07-11T17:00:00'),
            endTime: new Date('2026-07-11T20:00:00'),
            peakRating: 4,
            peakLabel: 'Good',
            period: 'Evening',
            hourCount: 3,
          },
        }),
      ],
      now
    );
    expect(result.verdict).toBe('wait');
    expect(result.headline).toContain('WAIT');
  });

  it('returns marginal when top match score is low', () => {
    const result = computeFishTodayVerdict([
      makeTarget({ matchScore: 28, goNowLabel: 'Best window: 6:00 AM – 8:00 AM' }),
    ]);
    expect(result.verdict).toBe('marginal');
  });
});
