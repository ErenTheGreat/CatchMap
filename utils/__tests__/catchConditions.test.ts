import { describe, expect, it } from 'vitest';
import { buildCatchConditions } from '@/utils/catchConditions';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';

const weather: WeatherSnapshot = {
  temperatureF: 67.6,
  windSpeedMph: 8.4,
  windDirection: 200,
  precipitationInch: 0,
  pressureMb: 1014.7,
  cloudCoverPercent: 10,
  isDay: true,
  pressureTrend: 'rising',
  moonPhaseLabel: 'Waxing Gibbous',
};

describe('buildCatchConditions', () => {
  it('returns null when there is nothing to snapshot', () => {
    expect(buildCatchConditions(null)).toBeNull();
    expect(buildCatchConditions(undefined, { tideNote: null })).toBeNull();
  });

  it('rounds weather values and derives a sky label', () => {
    const conditions = buildCatchConditions(weather);
    expect(conditions).not.toBeNull();
    expect(conditions?.temperatureF).toBe(68);
    expect(conditions?.windSpeedMph).toBe(8);
    expect(conditions?.pressureMb).toBe(1015);
    expect(conditions?.skyLabel).toBe('Clear');
    expect(conditions?.pressureTrend).toBe('rising');
    expect(conditions?.moonPhaseLabel).toBe('Waxing Gibbous');
  });

  it('classifies cloud cover into sky labels', () => {
    expect(buildCatchConditions({ ...weather, cloudCoverPercent: 40 })?.skyLabel).toBe(
      'Partly cloudy'
    );
    expect(buildCatchConditions({ ...weather, cloudCoverPercent: 70 })?.skyLabel).toBe(
      'Mostly cloudy'
    );
    expect(buildCatchConditions({ ...weather, cloudCoverPercent: 95 })?.skyLabel).toBe(
      'Overcast'
    );
  });

  it('captures a tide note even without weather', () => {
    const conditions = buildCatchConditions(null, { tideNote: 'Rising tide, peak in 2h' });
    expect(conditions?.tideNote).toBe('Rising tide, peak in 2h');
    expect(conditions?.temperatureF).toBeUndefined();
  });
});
