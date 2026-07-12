import type { CatchConditions } from '@/utils/storage';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';

function describeSky(cloudCoverPercent: number): string {
  if (cloudCoverPercent <= 15) return 'Clear';
  if (cloudCoverPercent <= 50) return 'Partly cloudy';
  if (cloudCoverPercent <= 85) return 'Mostly cloudy';
  return 'Overcast';
}

/**
 * Snapshot the conditions at catch time so the catch can show the weather it
 * was caught in later, even once the live forecast has moved on.
 */
export function buildCatchConditions(
  weather: WeatherSnapshot | null | undefined,
  extras?: { tideNote?: string | null }
): CatchConditions | null {
  const conditions: CatchConditions = {};

  if (weather) {
    conditions.temperatureF = Math.round(weather.temperatureF);
    conditions.windSpeedMph = Math.round(weather.windSpeedMph);
    conditions.cloudCoverPercent = weather.cloudCoverPercent;
    conditions.pressureMb = Math.round(weather.pressureMb);
    conditions.skyLabel = describeSky(weather.cloudCoverPercent);
    if (weather.pressureTrend) conditions.pressureTrend = weather.pressureTrend;
    if (weather.moonPhaseLabel) conditions.moonPhaseLabel = weather.moonPhaseLabel;
  }

  if (extras?.tideNote) conditions.tideNote = extras.tideNote;

  return Object.keys(conditions).length > 0 ? conditions : null;
}
