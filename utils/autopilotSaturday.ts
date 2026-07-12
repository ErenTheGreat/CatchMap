import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import type { TidePrediction } from '@/lib/api/endpoints/tides';
import type { SavedSpotSnapshot } from '@/lib/types/savedSpot';
import { savedSpotToNearbySpot } from '@/lib/types/savedSpot';
import { getTripDayOutlook } from '@/utils/bestTimeNow';
import { scoreSpotsForTripPlanning } from '@/utils/spotDiscoveryScore';
import {
  getBestTripWindow,
  formatTripWindowRange,
  type TripWindow,
} from '@/utils/tripPlanner';
import { getNextSaturday } from '@/utils/weekendPlanner';
import type { ActivityRating } from '@/utils/fishingEngine';

export const AUTOPILOT_TRAVEL_BUFFER_MINUTES = 50;
export const AUTOPILOT_MAX_LEGS = 3;

export interface SaturdayCandidate {
  spotId: string;
  spotName: string;
  latitude: number;
  longitude: number;
  window: TripWindow;
  peakRating: ActivityRating;
  peakLabel: string;
  speciesHint: string | null;
  windowRange: string;
}

export interface AutopilotLeg {
  legIndex: number;
  spotId: string;
  spotName: string;
  latitude: number;
  longitude: number;
  window: TripWindow;
  peakRating: ActivityRating;
  peakLabel: string;
  speciesHint: string | null;
  windowRange: string;
  travelNote: string | null;
}

export interface AutopilotSaturdayPlan {
  saturdayDate: Date;
  legs: AutopilotLeg[];
}

export function buildSaturdayCandidates(
  spots: SavedSpotSnapshot[],
  weatherBySpotId: Record<string, WeatherSnapshot | null>,
  tidesBySpotId: Record<string, TidePrediction[] | null> = {},
  saturdayDate: Date = getNextSaturday()
): SaturdayCandidate[] {
  const candidates: SaturdayCandidate[] = [];

  for (const spot of spots.slice(0, 5)) {
    const weather = weatherBySpotId[spot.id] ?? null;
    const tides = tidesBySpotId[spot.id] ?? null;
    const nearby = savedSpotToNearbySpot(spot);

    const outlook = getTripDayOutlook({
      latitude: spot.latitude,
      longitude: spot.longitude,
      weather,
      date: saturdayDate,
      tides,
    });

    const scores = scoreSpotsForTripPlanning([nearby], {
      weather,
      tides,
      now: saturdayDate,
      tripPlanning: true,
    });
    const hourly = scores[0]?.hourlyForecast ?? [];
    const window = getBestTripWindow(hourly, saturdayDate);
    if (!window || window.peakRating < 3) continue;

    candidates.push({
      spotId: spot.id,
      spotName: spot.name,
      latitude: spot.latitude,
      longitude: spot.longitude,
      window,
      peakRating: outlook.peakRating,
      peakLabel: outlook.label,
      speciesHint: scores[0]?.topSpeciesHint ?? null,
      windowRange: formatTripWindowRange(window),
    });
  }

  return candidates.sort((left, right) => {
    const ratingDiff = right.peakRating - left.peakRating;
    if (ratingDiff !== 0) return ratingDiff;
    return left.window.startTime.getTime() - right.window.startTime.getTime();
  });
}

function legEndsBeforeNext(
  previous: TripWindow,
  next: TripWindow,
  travelBufferMinutes: number
): boolean {
  const bufferMs = travelBufferMinutes * 60 * 1000;
  return next.startTime.getTime() >= previous.endTime.getTime() + bufferMs;
}

export function buildAutopilotSaturday(
  candidates: SaturdayCandidate[],
  options: {
    travelBufferMinutes?: number;
    maxLegs?: number;
    saturdayDate?: Date;
  } = {}
): AutopilotSaturdayPlan | null {
  const travelBufferMinutes = options.travelBufferMinutes ?? AUTOPILOT_TRAVEL_BUFFER_MINUTES;
  const maxLegs = options.maxLegs ?? AUTOPILOT_MAX_LEGS;
  const saturdayDate = options.saturdayDate ?? getNextSaturday();

  if (candidates.length === 0) return null;

  const legs: AutopilotLeg[] = [];

  for (const candidate of candidates) {
    if (legs.length >= maxLegs) break;

    const conflicts = legs.some((leg) => !legEndsBeforeNext(leg.window, candidate.window, travelBufferMinutes));
    if (conflicts) continue;

    const prevLeg = legs[legs.length - 1];
    const travelNote =
      prevLeg != null
        ? `~${travelBufferMinutes} min drive from ${prevLeg.spotName}`
        : null;

    legs.push({
      legIndex: legs.length + 1,
      spotId: candidate.spotId,
      spotName: candidate.spotName,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      window: candidate.window,
      peakRating: candidate.peakRating,
      peakLabel: candidate.peakLabel,
      speciesHint: candidate.speciesHint,
      windowRange: candidate.windowRange,
      travelNote,
    });
  }

  if (legs.length === 0) return null;

  return { saturdayDate, legs };
}
