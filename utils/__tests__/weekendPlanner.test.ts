import { describe, expect, it } from 'vitest';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import type { SavedSpotSnapshot } from '@/lib/types/savedSpot';
import { getNextSaturday, getNextSunday, rankWeekendOutlooks } from '@/utils/weekendPlanner';

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
  pressureTrend: 'stable',
};

function makeSavedSpot(id: string, name: string): SavedSpotSnapshot {
  return {
    id,
    name,
    latitude: 40.1,
    longitude: -74.2,
    water_type: 'lake',
    savedAt: Date.now(),
  };
}

describe('weekendPlanner', () => {
  it('getNextSaturday returns a Saturday', () => {
    const sat = getNextSaturday(new Date('2026-07-11T12:00:00')); // Saturday
    expect(sat.getDay()).toBe(6);
  });

  it('getNextSunday is day after next Saturday', () => {
    const sat = getNextSaturday(new Date('2026-07-10T12:00:00')); // Friday
    const sun = getNextSunday(new Date('2026-07-10T12:00:00'));
    expect(sun.getTime()).toBeGreaterThan(sat.getTime());
    expect(sun.getDay()).toBe(0);
  });

  it('rankWeekendOutlooks returns picks for saved spots', () => {
    const spot = makeSavedSpot('a', 'Lake A');
    const picks = rankWeekendOutlooks([spot], { a: weather });
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.some((p) => p.dayLabel === 'Saturday')).toBe(true);
    expect(picks.some((p) => p.dayLabel === 'Sunday')).toBe(true);
  });

  it('limits results', () => {
    const spots = [makeSavedSpot('a', 'A'), makeSavedSpot('b', 'B')];
    const weatherMap = { a: weather, b: weather };
    const picks = rankWeekendOutlooks(spots, weatherMap, {}, 2);
    expect(picks.length).toBeLessThanOrEqual(2);
  });
});
