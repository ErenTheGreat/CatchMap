import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';

export interface MoonData {
  moonPhase?: number;
  moonrise?: string;
  moonset?: string;
}

const MINOR_WINDOW_MS = 45 * 60 * 1000;
const MAJOR_WINDOW_MS = 60 * 60 * 1000;

function isWithinWindow(hourMs: number, eventMs: number, windowMs: number): boolean {
  return Math.abs(hourMs - eventMs) <= windowMs;
}

function parseMoonTime(time: string | undefined, hourDate: Date): number | null {
  if (!time) return null;
  const event = new Date(time);
  if (Number.isNaN(event.getTime())) return null;

  const adjusted = new Date(hourDate);
  adjusted.setHours(event.getHours(), event.getMinutes(), 0, 0);
  return adjusted.getTime();
}

function getMajorTransitTimes(moonriseMs: number | null, moonsetMs: number | null): number[] {
  if (moonriseMs == null || moonsetMs == null) return [];

  const overhead = moonriseMs + (moonsetMs - moonriseMs) / 2;
  const underfoot = overhead + 12 * 60 * 60 * 1000;
  return [overhead, underfoot];
}

function getMoonPhaseBoost(
  hourDate: Date,
  moonPhase: number | undefined,
  period: string
): number {
  if (moonPhase == null) return 0;

  const p = ((moonPhase % 1) + 1) % 1;
  const hour = hourDate.getHours();
  const isNight = period === 'Night' || hour < 6 || hour >= 20;

  if (p >= 0.45 && p <= 0.55 && isNight) return 0.5;
  if ((p < 0.05 || p > 0.95) && (period === 'Dawn Bite' || period === 'Morning')) return 0.5;
  return 0;
}

export function getSolunarBoost(
  hourDate: Date,
  moonData: MoonData | null | undefined,
  period: string
): number {
  if (!moonData) return 0;

  const hourMs = hourDate.getTime();
  let boost = 0;

  const moonriseMs = parseMoonTime(moonData.moonrise, hourDate);
  const moonsetMs = parseMoonTime(moonData.moonset, hourDate);

  if (moonriseMs != null && isWithinWindow(hourMs, moonriseMs, MINOR_WINDOW_MS)) {
    boost += 0.75;
  }
  if (moonsetMs != null && isWithinWindow(hourMs, moonsetMs, MINOR_WINDOW_MS)) {
    boost += 0.75;
  }

  for (const transitMs of getMajorTransitTimes(moonriseMs, moonsetMs)) {
    if (isWithinWindow(hourMs, transitMs, MAJOR_WINDOW_MS)) {
      boost += 1;
      break;
    }
  }

  boost += getMoonPhaseBoost(hourDate, moonData.moonPhase, period);
  return boost;
}

export function getSolunarHighlight(
  hourDate: Date,
  moonData: MoonData | null | undefined
): string | undefined {
  if (!moonData) return undefined;

  const hourMs = hourDate.getTime();
  const moonriseMs = parseMoonTime(moonData.moonrise, hourDate);
  const moonsetMs = parseMoonTime(moonData.moonset, hourDate);

  if (moonriseMs != null && isWithinWindow(hourMs, moonriseMs, MINOR_WINDOW_MS)) {
    return 'Moonrise feeding window';
  }
  if (moonsetMs != null && isWithinWindow(hourMs, moonsetMs, MINOR_WINDOW_MS)) {
    return 'Moonset feeding window';
  }

  for (const transitMs of getMajorTransitTimes(moonriseMs, moonsetMs)) {
    if (isWithinWindow(hourMs, transitMs, MAJOR_WINDOW_MS)) {
      return 'Major solunar period';
    }
  }

  return undefined;
}

export function getMoonDataFromWeather(weather: WeatherSnapshot | null | undefined): MoonData | null {
  if (!weather?.moonPhase && !weather?.moonrise && !weather?.moonset) return null;
  return {
    moonPhase: weather.moonPhase,
    moonrise: weather.moonrise,
    moonset: weather.moonset,
  };
}
