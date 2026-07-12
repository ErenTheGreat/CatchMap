import { describe, expect, it } from 'vitest';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import type { SavedSpotSnapshot } from '@/lib/types/savedSpot';
import {
  BITE_STORM_HOT_RATING,
  BITE_STORM_RATING_JUMP,
  buildSpotBiteSnapshot,
  detectBiteStorm,
  pickBestBiteStorm,
  type BiteStormSnapshot,
} from '@/utils/biteStorm';

const weather: WeatherSnapshot = {
  temperatureF: 72,
  windSpeedMph: 6,
  windDirection: 180,
  precipitationInch: 0,
  pressureMb: 1015,
  cloudCoverPercent: 20,
  isDay: true,
  sunrise: '2026-07-11T12:00:00.000Z',
  sunset: '2026-07-11T23:00:00.000Z',
  pressureTrend: 'falling',
};

const weatherStable: WeatherSnapshot = {
  ...weather,
  pressureTrend: 'stable',
};

function makeSpot(): SavedSpotSnapshot {
  return {
    id: 'lake-a',
    name: 'Lake Alpha',
    latitude: 40.1,
    longitude: -74.2,
    water_type: 'lake',
    savedAt: Date.now(),
  };
}

describe('biteStorm', () => {
  it('buildSpotBiteSnapshot returns rating from engine', () => {
    const spot = makeSpot();
    const snapshot = buildSpotBiteSnapshot(spot, weather);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.spotId).toBe('lake-a');
    expect(snapshot?.activityRating).toBeGreaterThanOrEqual(1);
    expect(snapshot?.activityRating).toBeLessThanOrEqual(5);
  });

  it('detectBiteStorm returns null without previous snapshot', () => {
    const spot = makeSpot();
    const current: BiteStormSnapshot = {
      spotId: spot.id,
      activityRating: 4,
      pressureTrend: 'falling',
      pressureMb: 1015,
      checkedAt: Date.now(),
    };
    expect(detectBiteStorm(spot, null, current, weather)).toBeNull();
  });

  it('detectBiteStorm fires on pressure flip + rating jump', () => {
    const spot = makeSpot();
    const previous: BiteStormSnapshot = {
      spotId: spot.id,
      activityRating: 2,
      pressureTrend: 'stable',
      pressureMb: 1018,
      checkedAt: Date.now() - 3600000,
    };
    const current: BiteStormSnapshot = {
      spotId: spot.id,
      activityRating: 4,
      pressureTrend: 'falling',
      pressureMb: 1014,
      checkedAt: Date.now(),
    };

    const alert = detectBiteStorm(spot, previous, current, weather);
    expect(alert).not.toBeNull();
    expect(alert?.spotName).toBe('Lake Alpha');
    expect(alert?.pressureFlipped).toBe(true);
    expect(alert?.ratingDelta).toBeGreaterThanOrEqual(BITE_STORM_RATING_JUMP);
    expect(alert?.headline).toContain('Bite Storm');
  });

  it('detectBiteStorm ignores marginal ratings', () => {
    const spot = makeSpot();
    const previous: BiteStormSnapshot = {
      spotId: spot.id,
      activityRating: 1,
      pressureTrend: 'stable',
      pressureMb: 1018,
      checkedAt: Date.now() - 3600000,
    };
    const current: BiteStormSnapshot = {
      spotId: spot.id,
      activityRating: 2,
      pressureTrend: 'falling',
      pressureMb: 1014,
      checkedAt: Date.now(),
    };
    expect(detectBiteStorm(spot, previous, current, weather)).toBeNull();
  });

  it('pickBestBiteStorm prefers highest rating', () => {
    const alerts = [
      {
        spotId: 'a',
        spotName: 'A',
        activityRating: 4 as const,
        ratingDelta: 2,
        pressureFlipped: true,
        solunarNear: false,
        windowRange: null,
        headline: 'A',
        detail: 'A',
      },
      {
        spotId: 'b',
        spotName: 'B',
        activityRating: 5 as const,
        ratingDelta: 1,
        pressureFlipped: false,
        solunarNear: true,
        windowRange: '7:00 AM – 9:00 AM',
        headline: 'B',
        detail: 'B',
      },
    ];
    expect(pickBestBiteStorm(alerts)?.spotId).toBe('b');
  });

  it('constants are sensible', () => {
    expect(BITE_STORM_HOT_RATING).toBe(4);
    expect(BITE_STORM_RATING_JUMP).toBeGreaterThan(1);
  });
});

describe('biteStorm stable weather', () => {
  it('does not fire on stable conditions without jump', () => {
    const spot = makeSpot();
    const previous: BiteStormSnapshot = {
      spotId: spot.id,
      activityRating: 3,
      pressureTrend: 'stable',
      pressureMb: 1015,
      checkedAt: Date.now() - 3600000,
    };
    const current: BiteStormSnapshot = {
      spotId: spot.id,
      activityRating: 3,
      pressureTrend: 'stable',
      pressureMb: 1015,
      checkedAt: Date.now(),
    };
    expect(detectBiteStorm(spot, previous, current, weatherStable)).toBeNull();
  });
});
