import { describe, expect, it } from 'vitest';
import type { HourlyWeatherPoint, WeatherSnapshot } from '@/lib/api/endpoints/weather';
import { getTripDayOutlook, prepareWeatherForDate } from '@/utils/bestTimeNow';
import { scoreSpotsForDiscovery, scoreSpotsForTripPlanning } from '@/utils/spotDiscoveryScore';
import type { NearbySpot } from '@/utils/osmFishingSpots';

function localHour(date: string, hour: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, hour, 0, 0).toISOString();
}

function morningSlots(
  date: string,
  windSpeedMph: number,
  precipitationInch = 0
): HourlyWeatherPoint[] {
  return Array.from({ length: 9 }, (_, index) => {
    const hour = 5 + index;
    return {
      time: localHour(date, hour),
      temperatureF: 68,
      windSpeedMph,
      precipitationInch,
      pressureMb: 1015,
      cloudCoverPercent: windSpeedMph >= 20 ? 90 : 10,
    };
  });
}

function makeSpot(id: string, distance: number): NearbySpot {
  return {
    id,
    name: `Spot ${id}`,
    description: null,
    latitude: 37.7,
    longitude: -122.4,
    water_type: 'lake',
    species: [],
    facilities: [],
    best_months: [6, 7, 8],
    rating: 3,
    created_at: '2026-01-01T00:00:00.000Z',
    distance,
    matchedSpecies: [],
    isPeakSeason: false,
  };
}

function makeWeather(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  const hourlyToday = [
    ...morningSlots('2026-07-08', 6),
    ...morningSlots('2026-07-09', 28, 0.35),
  ];

  return {
    temperatureF: 68,
    windSpeedMph: 6,
    windDirection: 180,
    precipitationInch: 0,
    pressureMb: 1015,
    cloudCoverPercent: 10,
    isDay: true,
    sunrise: localHour('2026-07-08', 6),
    sunset: localHour('2026-07-08', 20),
    pressureTrend: 'stable',
    hourlyToday,
    dailySunTimes: [
      {
        date: '2026-07-08',
        sunrise: localHour('2026-07-08', 6),
        sunset: localHour('2026-07-08', 20),
      },
      {
        date: '2026-07-09',
        sunrise: localHour('2026-07-09', 6),
        sunset: localHour('2026-07-09', 20),
      },
    ],
    ...overrides,
  };
}

describe('trip planning accuracy', () => {
  it('uses absolute ratings for trip planner instead of inflating top spots', () => {
    const spots = Array.from({ length: 50 }, (_, index) => makeSpot(`spot-${index}`, index + 1));
    const weather = makeWeather();
    const dawn = new Date(2026, 6, 8, 6, 0);

    const mapScores = scoreSpotsForDiscovery(spots, { weather, now: dawn });
    const tripScores = scoreSpotsForTripPlanning(spots, {
      weather,
      now: dawn,
      tripPlanning: true,
    });

    const mapExcellentCount = mapScores.filter((score) => score.activityRating === 5).length;
    const tripExcellentCount = tripScores.filter((score) => score.activityRating === 5).length;

    expect(mapExcellentCount).toBeGreaterThan(0);
    expect(tripExcellentCount).toBeLessThan(mapExcellentCount);
    expect(tripScores.every((score) => !score.isRelativeTier)).toBe(true);
  });

  it('prepareWeatherForDate uses forecast hour data instead of current conditions', () => {
    const weather = makeWeather();
    const tomorrowMorning = new Date(2026, 6, 9, 6, 0);

    const prepared = prepareWeatherForDate(weather, tomorrowMorning);
    expect(prepared?.windSpeedMph).toBe(28);
    expect(prepared?.precipitationInch).toBe(0.35);
  });

  it('returns different day outlooks when hourly forecast differs', () => {
    const weather = makeWeather();
    const todayMorning = new Date(2026, 6, 8, 6, 0);
    const tomorrowMorning = new Date(2026, 6, 9, 6, 0);

    const today = getTripDayOutlook({
      latitude: 37.7,
      longitude: -122.4,
      weather,
      date: todayMorning,
    });
    const tomorrow = getTripDayOutlook({
      latitude: 37.7,
      longitude: -122.4,
      weather,
      date: tomorrowMorning,
    });

    expect(today.hasLiveForecast).toBe(true);
    expect(tomorrow.hasLiveForecast).toBe(true);
    expect(today.peakRating).toBeGreaterThan(tomorrow.peakRating);
  });
});
