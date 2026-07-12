import type { HourlyBiteForecast } from '@/lib/api/endpoints/weather';
import { getLocalDateKey } from '@/lib/api/endpoints/weather';
import { getActivityLabel, type ActivityRating } from '@/utils/fishingEngine';

export interface TripWindow {
  startTime: Date;
  endTime: Date;
  peakRating: ActivityRating;
  peakLabel: string;
  period: string;
  hourCount: number;
}

const MIN_TRIP_RATING = 3;
const MAX_WINDOW_HOURS = 4;

/**
 * Finds the best contiguous bite window from an hourly forecast.
 * Expands around the peak hour while activity stays within one step of the peak.
 */
export function getBestTripWindow(
  forecast: HourlyBiteForecast[],
  referenceDate: Date = new Date()
): TripWindow | null {
  if (forecast.length === 0) return null;

  const dayKey = getLocalDateKey(referenceDate);
  const dayForecast = forecast.filter(
    (slot) => getLocalDateKey(new Date(slot.time)) === dayKey
  );
  const scoped = dayForecast.length > 0 ? dayForecast : forecast;
  const now = referenceDate;

  let peakIndex = 0;
  for (let index = 1; index < scoped.length; index++) {
    if (scoped[index].activityRating > scoped[peakIndex].activityRating) {
      peakIndex = index;
    }
  }

  const peakRating = scoped[peakIndex].activityRating;
  const threshold = Math.max(MIN_TRIP_RATING, peakRating - 1);

  let startIndex = peakIndex;
  let endIndex = peakIndex;

  while (
    startIndex > 0 &&
    scoped[startIndex - 1].activityRating >= threshold &&
    endIndex - startIndex + 1 < MAX_WINDOW_HOURS
  ) {
    startIndex--;
  }

  while (
    endIndex < scoped.length - 1 &&
    scoped[endIndex + 1].activityRating >= threshold &&
    endIndex - startIndex + 1 < MAX_WINDOW_HOURS
  ) {
    endIndex++;
  }

  const startTime = new Date(scoped[startIndex].time);
  const endSlot = scoped[endIndex];
  const endTime = new Date(endSlot.time);
  endTime.setHours(endTime.getHours() + 1);

  if (endTime <= now && peakRating < MIN_TRIP_RATING) {
    return null;
  }

  const dominantPeriod =
    scoped
      .slice(startIndex, endIndex + 1)
      .map((slot) => slot.period)
      .find(Boolean) ?? 'Fishing window';

  return {
    startTime,
    endTime,
    peakRating,
    peakLabel: getActivityLabel(peakRating),
    period: dominantPeriod,
    hourCount: endIndex - startIndex + 1,
  };
}

export function formatTripWindowRange(window: TripWindow): string {
  const fmt = (date: Date) =>
    date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${fmt(window.startTime)} – ${fmt(window.endTime)}`;
}

/** Label for species/spot targets — "Go now" when inside the bite window. */
export function buildGoNowLabel(
  window: TripWindow | null,
  now: Date = new Date()
): string {
  if (!window) return '';
  const inWindow = now >= window.startTime && now < window.endTime;
  if (inWindow) return 'Go now — bite window active';
  return `Best window: ${formatTripWindowRange(window)}`;
}

export function formatTripWindowSummary(
  window: TripWindow,
  spotName?: string
): string {
  const range = formatTripWindowRange(window);
  const place = spotName ? ` at ${spotName}` : '';
  return `Best fishing window${place}: ${range} (${window.peakLabel} · ${window.period})`;
}

function formatGoogleCalendarDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}00`
  );
}

export function buildGoogleCalendarUrl(options: {
  title: string;
  startTime: Date;
  endTime: Date;
  details?: string;
  latitude?: number;
  longitude?: number;
}): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: options.title,
    dates: `${formatGoogleCalendarDate(options.startTime)}/${formatGoogleCalendarDate(options.endTime)}`,
  });

  if (options.details) {
    params.set('details', options.details);
  }

  if (options.latitude != null && options.longitude != null) {
    params.set('location', `${options.latitude},${options.longitude}`);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
