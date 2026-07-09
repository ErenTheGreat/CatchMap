import { describe, expect, it } from 'vitest';
import {
  buildBiteHeatmapGeoJson,
  getBiteHeatmapStatus,
  isWaterBodySpot,
} from '@/utils/biteHeatmap';
import type { NearbySpot } from '@/utils/osmFishingSpots';

function makeSpot(
  id: string,
  lat: number,
  lon: number,
  overrides: Partial<NearbySpot> = {}
): NearbySpot {
  return {
    id,
    name: `Spot ${id}`,
    latitude: lat,
    longitude: lon,
    water_type: 'lake',
    species: [],
    facilities: [],
    best_months: [],
    rating: 4,
    created_at: '',
    distance: 0,
    matchedSpecies: [],
    isPeakSeason: false,
    description: null,
    poiType: 'water',
    ...overrides,
  };
}

describe('isWaterBodySpot', () => {
  it('excludes ramps and marinas', () => {
    expect(isWaterBodySpot(makeSpot('1', 34, -118))).toBe(true);
    expect(
      isWaterBodySpot(makeSpot('2', 34, -118, { poiType: 'access_ramp', water_type: 'boat_ramp' }))
    ).toBe(false);
    expect(
      isWaterBodySpot(makeSpot('3', 34, -118, { poiType: 'marina', water_type: 'marina' }))
    ).toBe(false);
  });
});

describe('getBiteHeatmapStatus', () => {
  it('returns no_scores when nothing is scored', () => {
    const spots = [makeSpot('1', 34, -118), makeSpot('2', 34.01, -118.01)];
    expect(getBiteHeatmapStatus(spots, {})).toBe('no_scores');
  });

  it('returns needs_more_spots when fewer than 3 scored water spots', () => {
    const spots = [makeSpot('1', 34, -118), makeSpot('2', 34.01, -118.01), makeSpot('3', 34.02, -118.02)];
    const scores = {
      '1': { spotId: '1', activityRating: 4 as const, rawScore: 4 },
      '2': { spotId: '2', activityRating: 3 as const, rawScore: 3 },
    };
    expect(getBiteHeatmapStatus(spots, scores as never)).toBe('needs_more_spots');
  });

  it('ignores scored ramps when counting water spots', () => {
    const spots = [
      makeSpot('1', 34, -118),
      makeSpot('2', 34.01, -118.01),
      makeSpot('ramp', 34.02, -118.02, { poiType: 'access_ramp', water_type: 'boat_ramp' }),
    ];
    const scores = Object.fromEntries(
      spots.map((spot) => [spot.id, { spotId: spot.id, activityRating: 4 as const, rawScore: 4 }])
    );
    expect(getBiteHeatmapStatus(spots, scores as never)).toBe('needs_more_spots');
  });

  it('returns ready with at least 3 scored water spots', () => {
    const spots = [makeSpot('1', 34, -118), makeSpot('2', 34.01, -118.01), makeSpot('3', 34.02, -118.02)];
    const scores = Object.fromEntries(
      spots.map((spot) => [spot.id, { spotId: spot.id, activityRating: 4 as const, rawScore: 4 }])
    );
    expect(getBiteHeatmapStatus(spots, scores as never)).toBe('ready');
  });
});

describe('buildBiteHeatmapGeoJson', () => {
  it('returns null with too few scored water spots', () => {
    const spots = [makeSpot('1', 34, -118)];
    expect(buildBiteHeatmapGeoJson(spots, {})).toBeNull();
  });

  it('places features on water spot coordinates only', () => {
    const spots = [
      makeSpot('1', 34, -118),
      makeSpot('2', 34.05, -118.05),
      makeSpot('3', 34.1, -118.1),
      makeSpot('ramp', 34.5, -118.5, { poiType: 'access_ramp', water_type: 'boat_ramp' }),
    ];
    const scores = Object.fromEntries(
      spots.map((spot) => [spot.id, { spotId: spot.id, activityRating: 4 as const, rawScore: 4.5 }])
    );
    const geo = buildBiteHeatmapGeoJson(spots, scores as never);
    expect(geo?.features.length).toBe(3);
    for (const feature of geo?.features ?? []) {
      const [lon, lat] = feature.geometry.coordinates;
      expect(lat).toBeGreaterThanOrEqual(34);
      expect(lat).toBeLessThanOrEqual(34.1);
      expect(lon).toBeGreaterThanOrEqual(-118.1);
      expect(lon).toBeLessThanOrEqual(-118);
    }
  });

  it('adds bridge points only between nearby water spots', () => {
    const spots = [
      makeSpot('1', 34, -118),
      makeSpot('2', 34.001, -118.001),
      makeSpot('3', 34.5, -118.5),
    ];
    const scores = Object.fromEntries(
      spots.map((spot) => [spot.id, { spotId: spot.id, activityRating: 4 as const, rawScore: 4 }])
    );
    const geo = buildBiteHeatmapGeoJson(spots, scores as never);
    expect(geo?.features.length).toBe(4);
  });
});
