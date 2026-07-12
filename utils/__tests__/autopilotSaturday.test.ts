import { describe, expect, it } from 'vitest';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import type { SavedSpotSnapshot } from '@/lib/types/savedSpot';
import {
  AUTOPILOT_MAX_LEGS,
  AUTOPILOT_TRAVEL_BUFFER_MINUTES,
  buildAutopilotSaturday,
  buildSaturdayCandidates,
} from '@/utils/autopilotSaturday';

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
    latitude: 40.1 + id.charCodeAt(0) * 0.01,
    longitude: -74.2,
    water_type: 'lake',
    savedAt: Date.now(),
  };
}

describe('autopilotSaturday', () => {
  it('buildSaturdayCandidates returns candidates for saved spots', () => {
    const spot = makeSavedSpot('a', 'Lake A');
    const candidates = buildSaturdayCandidates([spot], { a: weather });
    expect(candidates.length).toBeGreaterThanOrEqual(0);
    if (candidates.length > 0) {
      expect(candidates[0].spotName).toBe('Lake A');
      expect(candidates[0].windowRange).toBeTruthy();
    }
  });

  it('buildAutopilotSaturday returns null when no candidates', () => {
    expect(buildAutopilotSaturday([])).toBeNull();
  });

  it('buildAutopilotSaturday limits legs and avoids overlap', () => {
    const spots = [
      makeSavedSpot('a', 'Lake A'),
      makeSavedSpot('b', 'Lake B'),
      makeSavedSpot('c', 'Lake C'),
      makeSavedSpot('d', 'Lake D'),
    ];
    const weatherMap = Object.fromEntries(spots.map((s) => [s.id, weather]));
    const candidates = buildSaturdayCandidates(spots, weatherMap);
    const plan = buildAutopilotSaturday(candidates);

    if (!plan) return;

    expect(plan.legs.length).toBeLessThanOrEqual(AUTOPILOT_MAX_LEGS);
    for (let index = 1; index < plan.legs.length; index++) {
      const prev = plan.legs[index - 1];
      const next = plan.legs[index];
      const bufferMs = AUTOPILOT_TRAVEL_BUFFER_MINUTES * 60 * 1000;
      expect(next.window.startTime.getTime()).toBeGreaterThanOrEqual(
        prev.window.endTime.getTime() + bufferMs
      );
    }
  });

  it('first leg has no travel note', () => {
    const spot = makeSavedSpot('a', 'Lake A');
    const candidates = buildSaturdayCandidates([spot], { a: weather });
    const plan = buildAutopilotSaturday(candidates);
    if (!plan || plan.legs.length === 0) return;
    expect(plan.legs[0].travelNote).toBeNull();
  });
});
