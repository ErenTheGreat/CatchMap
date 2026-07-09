import { describe, expect, it } from 'vitest';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import type { NearbySpot } from '@/utils/osmFishingSpots';
import {
  assignAbsoluteDiscoveryRating,
  balanceViewportRatings,
  buildScoresBySpotId,
  filterDiscoverySpots,
  getHourBucket,
  HOT_NOW_MIN_RATING,
  rankDiscoverySpots,
  scoreSpotsForDiscovery,
  scoreSpotForDiscovery,
  sortSpotsByDiscoveryScore,
} from '@/utils/spotDiscoveryScore';

const weather: WeatherSnapshot = {
  temperatureF: 68,
  windSpeedMph: 6,
  windDirection: 180,
  precipitationInch: 0,
  pressureMb: 1015,
  cloudCoverPercent: 10,
  isDay: true,
  sunrise: '2026-07-07T12:00:00.000Z',
  sunset: '2026-07-08T01:00:00.000Z',
  pressureTrend: 'stable',
};

function makeSpot(
  id: string,
  distance: number,
  latitude: number,
  longitude: number,
  waterType = 'lake',
  overrides: Partial<NearbySpot> = {}
): NearbySpot {
  return {
    id,
    name: `Spot ${id}`,
    description: null,
    latitude,
    longitude,
    water_type: waterType,
    species: [],
    facilities: [],
    best_months: [6, 7, 8],
    rating: 3,
    created_at: '2026-01-01T00:00:00.000Z',
    distance,
    matchedSpecies: [],
    isPeakSeason: false,
    ...overrides,
  };
}

describe('spotDiscoveryScore', () => {
  it('scores visible spots and caps at 50 closest', () => {
    const spots = Array.from({ length: 55 }, (_, index) =>
      makeSpot(`spot-${index}`, index + 1, 37.7 + index * 0.001, -122.4)
    );

    const scores = scoreSpotsForDiscovery(spots, { weather });
    expect(scores).toHaveLength(50);
    expect(scores.every((score) => score.activityRating >= 1 && score.activityRating <= 5)).toBe(
      true
    );
  });

  it('ranks spots by activity rating then distance', () => {
    const spots = [
      makeSpot('near', 1, 37.71, -122.41, 'coastal', { rating: 4.8 }),
      makeSpot('far', 10, 37.8, -122.5),
      makeSpot('mid', 5, 37.75, -122.45, 'lake'),
    ];

    const scoresBySpotId = buildScoresBySpotId(
      scoreSpotsForDiscovery(spots, {
        weather,
        tides: [{ time: '2026-07-08T12:00:00.000Z', type: 'high', heightFeet: 5.2 }],
      })
    );
    const ranked = rankDiscoverySpots(spots, scoresBySpotId);

    expect(ranked.length).toBe(3);
    for (let index = 1; index < ranked.length; index++) {
      const prev = ranked[index - 1];
      const current = ranked[index];
      expect(prev.score.activityRating).toBeGreaterThanOrEqual(current.score.activityRating);
      if (prev.score.activityRating === current.score.activityRating) {
        expect(prev.spot.distance).toBeLessThanOrEqual(current.spot.distance);
      }
    }
  });

  it('does not inflate ratings from inferred species metadata', () => {
    const dawn = new Date(2026, 6, 8, 5, 45);
    const plain = makeSpot('plain', 1, 37.71, -122.41);
    const inflated = {
      ...plain,
      id: 'inflated',
      matchedSpecies: ['Largemouth Bass', 'Rainbow Trout', 'Channel Catfish'],
      best_months: [6, 7, 8],
      isPeakSeason: true,
    };

    const plainScore = scoreSpotsForDiscovery([plain], { weather, now: dawn })[0];
    const inflatedScore = scoreSpotsForDiscovery([inflated], { weather, now: dawn })[0];

    expect(inflatedScore.activityRating).toBe(plainScore.activityRating);
  });

  it('filters hot spots by minimum rating threshold', () => {
    const spots = Array.from({ length: 12 }, (_, index) =>
      makeSpot(`spot-${index}`, index + 1, 37.7 + index * 0.01, -122.4 + index * 0.01)
    );
    const scoresBySpotId = buildScoresBySpotId(
      scoreSpotsForDiscovery(spots, { weather })
    );

    const hotSpots = filterDiscoverySpots(spots, scoresBySpotId, 'hot');
    for (const spot of hotSpots) {
      expect(scoresBySpotId[spot.id]?.activityRating ?? 0).toBeGreaterThanOrEqual(
        HOT_NOW_MIN_RATING
      );
    }
  });

  it('filters active spots with recent community catches', () => {
    const spots = [
      makeSpot('active', 1, 37.71, -122.41),
      makeSpot('quiet', 2, 37.72, -122.42),
    ];
    const scoresBySpotId = buildScoresBySpotId([
      {
        spotId: 'active',
        activityRating: 3,
        label: 'Good',
        period: 'Morning',
        summary: 'Good · Morning',
        tip: '',
        factors: [],
        hourlyForecast: [],
        communityCatchCount: 5,
        hasCommunityActivity: true,
      },
      {
        spotId: 'quiet',
        activityRating: 3,
        label: 'Good',
        period: 'Morning',
        summary: 'Good · Morning',
        tip: '',
        factors: [],
        hourlyForecast: [],
      },
    ]);

    const activeSpots = filterDiscoverySpots(spots, scoresBySpotId, 'active');
    expect(activeSpots).toHaveLength(1);
    expect(activeSpots[0]?.id).toBe('active');
  });

  it('sorts category spots by discovery score', () => {
    const spots = [
      makeSpot('a', 3, 37.71, -122.41, 'lake', { isPeakSeason: true }),
      makeSpot('b', 1, 37.72, -122.42),
      makeSpot('c', 2, 37.73, -122.43),
    ];
    const scoresBySpotId = buildScoresBySpotId(
      scoreSpotsForDiscovery(spots, { weather })
    );

    const sorted = sortSpotsByDiscoveryScore(spots, scoresBySpotId);
    expect(sorted.map((spot) => spot.id)).toEqual(
      [...spots]
        .sort((left, right) => {
          const leftRating = scoresBySpotId[left.id]?.activityRating ?? 0;
          const rightRating = scoresBySpotId[right.id]?.activityRating ?? 0;
          if (rightRating !== leftRating) return rightRating - leftRating;
          return left.distance - right.distance;
        })
        .map((spot) => spot.id)
    );
  });

  it('builds stable hour buckets for query caching', () => {
    const date = new Date(2026, 6, 8, 14, 30);
    expect(getHourBucket(date)).toBe('2026-6-8-14');
  });

  it('keeps identical spots on the same relative tier', () => {
    const dawn = new Date(2026, 6, 8, 5, 45);
    const spots = Array.from({ length: 8 }, (_, index) =>
      makeSpot(`spot-${index}`, index + 1, 37.7 + index * 0.01, -122.4 + index * 0.01)
    );

    const first = scoreSpotsForDiscovery(spots, { weather, now: dawn });
    const second = scoreSpotsForDiscovery(spots, { weather, now: dawn });

    expect(second.map((score) => score.activityRating)).toEqual(
      first.map((score) => score.activityRating)
    );
  });

  it('spreads viewport spots across multiple tiers at dawn', () => {
    const dawn = new Date(2026, 6, 8, 5, 45);
    const spots = Array.from({ length: 20 }, (_, index) =>
      makeSpot(`spot-${index}`, index + 1, 37.7 + index * 0.01, -122.4 + index * 0.01)
    );

    const scores = scoreSpotsForDiscovery(spots, { weather, now: dawn });
    const tiers = new Set(scores.map((score) => score.activityRating));

    expect(tiers.size).toBeGreaterThanOrEqual(3);
    expect(scores.every((score) => score.isRelativeTier)).toBe(true);
  });

  it('hot filter returns a minority of visible spots with relative tiers', () => {
    const spots = Array.from({ length: 20 }, (_, index) =>
      makeSpot(`spot-${index}`, index + 1, 37.7 + index * 0.01, -122.4 + index * 0.01)
    );
    const scoresBySpotId = buildScoresBySpotId(
      scoreSpotsForDiscovery(spots, { weather })
    );

    const hotSpots = filterDiscoverySpots(spots, scoresBySpotId, 'hot');
    expect(hotSpots.length).toBeLessThan(spots.length);
    expect(hotSpots.length).toBeLessThanOrEqual(Math.ceil(spots.length * 0.25));
  });

  it('assigns different relative tiers when raw scores differ', () => {
    const spots = [
      makeSpot('coastal', 1, 37.71, -122.41, 'coastal', { rating: 4.8 }),
      makeSpot('inland', 2, 37.75, -122.45, 'lake'),
    ];
    const scores = scoreSpotsForDiscovery(spots, {
      weather,
      tides: [{ time: '2026-07-08T12:00:00.000Z', type: 'high', heightFeet: 5.2 }],
    });

    expect(scores[0].activityRating).toBeGreaterThan(scores[1].activityRating);
  });

  it('uses absolute tier for a single spot', () => {
    const spot = makeSpot('solo', 1, 37.71, -122.41);
    const score = scoreSpotForDiscovery(spot, { weather });

    expect(score.isRelativeTier).toBe(false);
    expect(score.activityRating).toBe(assignAbsoluteDiscoveryRating(score.rawScore ?? 0));
  });

  it('maps viewport raw scores to relative display tiers', () => {
    const balanced = balanceViewportRatings(
      [5.6, 5.0, 4.0, 3.0, 2.0, 1.0].map((rawScore, index) => ({
        spotId: `spot-${index}`,
        rawScore,
        period: 'Dawn Bite',
        tip: '',
        factors: [],
        hourlyForecast: [],
      }))
    );

    expect(balanced.map((score) => score.activityRating)).toEqual([4, 3, 2, 2, 1, 1]);
    expect(balanced.every((score) => score.isRelativeTier)).toBe(true);
  });
});
