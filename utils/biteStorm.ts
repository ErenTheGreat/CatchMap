import type { SavedSpotSnapshot } from '@/lib/types/savedSpot';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import { getBestTimeNow } from '@/utils/bestTimeNow';
import { getBestTripWindow, formatTripWindowRange } from '@/utils/tripPlanner';
import type { ActivityRating } from '@/utils/fishingEngine';
import { getSolunarBoost, getMoonDataFromWeather } from '@/utils/solunar';

export const BITE_STORM_RATING_JUMP = 1.5;
export const BITE_STORM_HOT_RATING: ActivityRating = 4;

export interface BiteStormSnapshot {
  spotId: string;
  activityRating: ActivityRating;
  pressureTrend: WeatherSnapshot['pressureTrend'];
  pressureMb: number;
  checkedAt: number;
}

export interface BiteStormAlert {
  spotId: string;
  spotName: string;
  activityRating: ActivityRating;
  ratingDelta: number;
  pressureFlipped: boolean;
  solunarNear: boolean;
  windowRange: string | null;
  headline: string;
  detail: string;
}

export function buildSpotBiteSnapshot(
  spot: SavedSpotSnapshot,
  weather: WeatherSnapshot | null | undefined,
  now: Date = new Date()
): BiteStormSnapshot | null {
  if (!weather) return null;

  const bite = getBestTimeNow({
    latitude: spot.latitude,
    longitude: spot.longitude,
    weather,
    date: now,
  });

  return {
    spotId: spot.id,
    activityRating: bite.activityRating,
    pressureTrend: weather.pressureTrend ?? 'stable',
    pressureMb: weather.pressureMb,
    checkedAt: now.getTime(),
  };
}

function isPressureFlipFavorable(
  previous: BiteStormSnapshot['pressureTrend'],
  current: BiteStormSnapshot['pressureTrend']
): boolean {
  return previous !== 'falling' && current === 'falling';
}

function isSolunarNearPeak(weather: WeatherSnapshot, now: Date): boolean {
  const moonData = getMoonDataFromWeather(weather);
  return getSolunarBoost(now, moonData, 'Morning') > 0 || getSolunarBoost(now, moonData, 'Evening') > 0;
}

export function detectBiteStorm(
  spot: SavedSpotSnapshot,
  previous: BiteStormSnapshot | null | undefined,
  current: BiteStormSnapshot,
  weather: WeatherSnapshot,
  now: Date = new Date()
): BiteStormAlert | null {
  if (!previous || previous.spotId !== spot.id) return null;

  const ratingDelta = current.activityRating - previous.activityRating;
  const pressureFlipped = isPressureFlipFavorable(previous.pressureTrend, current.pressureTrend);
  const crossedHot =
    previous.activityRating < BITE_STORM_HOT_RATING &&
    current.activityRating >= BITE_STORM_HOT_RATING;
  const bigJump = ratingDelta >= BITE_STORM_RATING_JUMP;

  if (!bigJump && !pressureFlipped && !crossedHot) return null;
  if (current.activityRating < 3) return null;

  const bite = getBestTimeNow({
    latitude: spot.latitude,
    longitude: spot.longitude,
    weather,
    date: now,
  });
  const window = getBestTripWindow(bite.hourlyForecast, now);
  const windowRange = window ? formatTripWindowRange(window) : null;
  const solunarNear = isSolunarNearPeak(weather, now);

  const reasons: string[] = [];
  if (pressureFlipped) reasons.push('pressure dropping');
  if (bigJump || crossedHot) reasons.push(`bite score jumped to ${current.activityRating}/5`);
  if (solunarNear) reasons.push('solunar peak approaching');

  const reasonText = reasons.join(', ');
  const headline = `Bite Storm at ${spot.name}`;
  const detail = `${reasonText.charAt(0).toUpperCase()}${reasonText.slice(1)}.${windowRange ? ` Window: ${windowRange}.` : ''} GO NOW.`;

  return {
    spotId: spot.id,
    spotName: spot.name,
    activityRating: current.activityRating,
    ratingDelta,
    pressureFlipped,
    solunarNear,
    windowRange,
    headline,
    detail,
  };
}

export function formatBiteStormNotificationTitle(alert: BiteStormAlert): string {
  return alert.headline;
}

export function formatBiteStormNotificationBody(alert: BiteStormAlert): string {
  return alert.detail;
}

export function pickBestBiteStorm(alerts: BiteStormAlert[]): BiteStormAlert | null {
  if (alerts.length === 0) return null;
  return [...alerts].sort((left, right) => {
    const ratingDiff = right.activityRating - left.activityRating;
    if (ratingDiff !== 0) return ratingDiff;
    return right.ratingDelta - left.ratingDelta;
  })[0] ?? null;
}
