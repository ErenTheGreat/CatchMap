import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import type { TidePrediction } from '@/lib/api/endpoints/tides';
import type { SavedSpotSnapshot } from '@/lib/types/savedSpot';
import { getTripDayOutlook } from '@/utils/bestTimeNow';
import { savedSpotToNearbySpot } from '@/lib/types/savedSpot';
import { scoreSpotsForTripPlanning } from '@/utils/spotDiscoveryScore';
import { getBestTripWindow, formatTripWindowRange } from '@/utils/tripPlanner';
import type { ActivityRating } from '@/utils/fishingEngine';

export interface WeekendPick {
  spotId: string;
  spotName: string;
  dayLabel: 'Saturday' | 'Sunday';
  date: Date;
  peakRating: ActivityRating;
  peakLabel: string;
  windowRange: string | null;
  latitude: number;
  longitude: number;
}

export function getNextSaturday(from: Date = new Date()): Date {
  const date = new Date(from);
  const day = date.getDay();
  const daysUntil = (6 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntil);
  date.setHours(7, 0, 0, 0);
  return date;
}

export function getNextSunday(from: Date = new Date()): Date {
  const saturday = getNextSaturday(from);
  const sunday = new Date(saturday);
  sunday.setDate(sunday.getDate() + 1);
  sunday.setHours(7, 0, 0, 0);
  return sunday;
}

export function rankWeekendOutlooks(
  spots: SavedSpotSnapshot[],
  weatherBySpotId: Record<string, WeatherSnapshot | null>,
  tidesBySpotId: Record<string, TidePrediction[] | null> = {},
  limit = 3
): WeekendPick[] {
  const picks: WeekendPick[] = [];
  const weekendDays: Array<{ label: 'Saturday' | 'Sunday'; date: Date }> = [
    { label: 'Saturday', date: getNextSaturday() },
    { label: 'Sunday', date: getNextSunday() },
  ];

  for (const spot of spots.slice(0, 5)) {
    const weather = weatherBySpotId[spot.id] ?? null;
    const tides = tidesBySpotId[spot.id] ?? null;
    const nearby = savedSpotToNearbySpot(spot);

    for (const { label, date } of weekendDays) {
      const outlook = getTripDayOutlook({
        latitude: spot.latitude,
        longitude: spot.longitude,
        weather,
        date,
        tides,
      });

      const scores = scoreSpotsForTripPlanning([nearby], {
        weather,
        tides,
        now: date,
        tripPlanning: true,
      });
      const hourly = scores[0]?.hourlyForecast ?? [];
      const window = getBestTripWindow(hourly, date);

      picks.push({
        spotId: spot.id,
        spotName: spot.name,
        dayLabel: label,
        date,
        peakRating: outlook.peakRating,
        peakLabel: outlook.label,
        windowRange: window ? formatTripWindowRange(window) : null,
        latitude: spot.latitude,
        longitude: spot.longitude,
      });
    }
  }

  return picks
    .sort((left, right) => {
      const diff = right.peakRating - left.peakRating;
      if (diff !== 0) return diff;
      return left.spotName.localeCompare(right.spotName);
    })
    .slice(0, limit);
}
