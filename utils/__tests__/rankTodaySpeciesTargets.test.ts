import { describe, expect, it } from 'vitest';
import type { HourlyBiteForecast } from '@/lib/api/endpoints/weather';
import type { SpeciesPrediction } from '@/lib/types/speciesPrediction';
import type { NearbySpot } from '@/utils/osmFishingSpots';
import type { RankedDiscoverySpot } from '@/utils/spotDiscoveryScore';
import { rankTodaySpeciesTargets } from '@/utils/rankTodaySpeciesTargets';
import { buildGoNowLabel } from '@/utils/tripPlanner';

function makeSpot(id: string, name: string, distance = 2): NearbySpot {
  return {
    id,
    name,
    description: null,
    latitude: 40,
    longitude: -74,
    water_type: 'lake',
    species: [],
    facilities: [],
    best_months: [6, 7],
    rating: 4,
    created_at: '2026-01-01T00:00:00.000Z',
    distance,
    matchedSpecies: [],
    isPeakSeason: false,
  };
}

function makeRanked(
  spot: NearbySpot,
  rating: number,
  label: string,
  hourlyForecast: HourlyBiteForecast[] = []
): RankedDiscoverySpot {
  return {
    spot,
    rank: 1,
    score: {
      spotId: spot.id,
      activityRating: rating as 1 | 2 | 3 | 4 | 5,
      label,
      period: 'Morning',
      summary: `${label} · Morning`,
      tip: 'Try cover',
      factors: [],
      hourlyForecast,
    },
  };
}

function makePrediction(
  id: string,
  name: string,
  probability: number,
  overrides: Partial<SpeciesPrediction> = {}
): SpeciesPrediction {
  return {
    id,
    name,
    scientificName: 'Test sp.',
    imageUrl: null,
    feedingZone: 'mid',
    idealTempMin: 15,
    idealTempMax: 25,
    monthStart: 1,
    monthEnd: 12,
    activityRating: 'High',
    score: probability / 20,
    probability,
    factors: [{ name: 'Water temp', impact: '+', detail: 'In ideal range', weight: 0.25 }],
    source: 'bundled',
    dataConfidence: 'high',
    ...overrides,
  };
}

describe('rankTodaySpeciesTargets', () => {
  it('returns empty when no enriched species data exists', () => {
    const spot = makeSpot('a', 'Lake A');
    const result = rankTodaySpeciesTargets({
      rankedSpots: [makeRanked(spot, 5, 'Hot')],
      speciesBySpotId: {},
    });
    expect(result).toEqual([]);
  });

  it('ranks species by probability × bite score × confidence', () => {
    const lakeA = makeSpot('a', 'Lake Alpha');
    const lakeB = makeSpot('b', 'Lake Beta');

    const result = rankTodaySpeciesTargets({
      rankedSpots: [makeRanked(lakeA, 5, 'Hot'), makeRanked(lakeB, 3, 'Fair')],
      speciesBySpotId: {
        a: [makePrediction('bass', 'Largemouth Bass', 72)],
        b: [makePrediction('trout', 'Rainbow Trout', 80, { dataConfidence: 'medium' })],
      },
    });

    expect(result[0]?.speciesName).toBe('Largemouth Bass');
    expect(result[0]?.bestSpot.name).toBe('Lake Alpha');
    expect(result.some((item) => item.speciesName === 'Rainbow Trout')).toBe(true);
  });

  it('excludes weak category-only estimates', () => {
    const spot = makeSpot('a', 'Pond');
    const result = rankTodaySpeciesTargets({
      rankedSpots: [makeRanked(spot, 4, 'Good')],
      speciesBySpotId: {
        a: [
          makePrediction('guess', 'Mystery Fish', 40, {
            source: 'category',
            dataConfidence: 'low',
          }),
        ],
      },
    });
    expect(result).toEqual([]);
  });

  it('boosts species that match personal catch history', () => {
    const lakeA = makeSpot('a', 'Lake Alpha');
    const lakeB = makeSpot('b', 'Lake Beta');

    const result = rankTodaySpeciesTargets({
      rankedSpots: [makeRanked(lakeA, 4, 'Good'), makeRanked(lakeB, 4, 'Good')],
      speciesBySpotId: {
        a: [makePrediction('bass', 'Largemouth Bass', 58)],
        b: [makePrediction('trout', 'Rainbow Trout', 55)],
      },
      personalSpecies: [{ species: 'Rainbow Trout', count: 6 }],
    });

    expect(result[0]?.speciesName).toBe('Rainbow Trout');
    expect(result[0]?.personalMatch).toBe(true);
  });

  it('attaches best bite window and go-now label from spot hourly forecast', () => {
    const spot = makeSpot('a', 'Lake Alpha');
    const now = new Date('2026-07-11T14:00:00');
    const windowStart = new Date('2026-07-11T17:00:00');
    const windowPeak = new Date('2026-07-11T18:00:00');
    const windowEnd = new Date('2026-07-11T19:00:00');

    const forecast: HourlyBiteForecast[] = [
      {
        time: windowStart.toISOString(),
        hourLabel: '5 PM',
        activityRating: 4,
        period: 'Evening Bite',
      },
      {
        time: windowPeak.toISOString(),
        hourLabel: '6 PM',
        activityRating: 5,
        period: 'Evening Bite',
      },
      {
        time: windowEnd.toISOString(),
        hourLabel: '7 PM',
        activityRating: 4,
        period: 'Evening Bite',
      },
    ];

    const result = rankTodaySpeciesTargets({
      rankedSpots: [makeRanked(spot, 5, 'Hot', forecast)],
      speciesBySpotId: {
        a: [makePrediction('bass', 'Largemouth Bass', 72)],
      },
      now,
    });

    expect(result[0]?.bestWindow).not.toBeNull();
    expect(result[0]?.goNowLabel).toContain('Best window:');
    expect(buildGoNowLabel(result[0]?.bestWindow ?? null, now)).toBe(result[0]?.goNowLabel);
  });
});
