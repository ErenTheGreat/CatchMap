import { describe, expect, it } from 'vitest';
import {
  removeSavedSpot,
  upsertRecentSpot,
  upsertSavedSpot,
} from '@/utils/savedSpotsStorage';
import { nearbySpotToSnapshot } from '@/lib/types/savedSpot';
import { buildSpotMapsUrls } from '@/utils/spotMapsUrls';
import type { NearbySpot } from '@/utils/osmFishingSpots';

function makeSpot(id: string): NearbySpot {
  return {
    id,
    name: `Lake ${id}`,
    description: null,
    latitude: 37.7,
    longitude: -122.4,
    water_type: 'lake',
    species: [],
    facilities: [],
    best_months: [6, 7],
    rating: 4,
    created_at: '2026-01-01T00:00:00.000Z',
    distance: 1,
    matchedSpecies: [],
    isPeakSeason: false,
  };
}

describe('savedSpotsStorage', () => {
  it('adds and removes saved spots', () => {
    const first = upsertSavedSpot([], makeSpot('a'));
    expect(first).toHaveLength(1);
    const second = upsertSavedSpot(first, makeSpot('b'));
    expect(second).toHaveLength(2);
    const removed = removeSavedSpot(second, 'a');
    expect(removed.map((spot) => spot.id)).toEqual(['b']);
  });

  it('moves recent spot to front', () => {
    const initial = upsertRecentSpot([], makeSpot('a'));
    const next = upsertRecentSpot(initial, makeSpot('b'));
    const again = upsertRecentSpot(next, makeSpot('a'));
    expect(again[0].id).toBe('a');
    expect(again).toHaveLength(2);
  });

  it('creates stable snapshots from nearby spots', () => {
    const snapshot = nearbySpotToSnapshot(makeSpot('x'));
    expect(snapshot.id).toBe('x');
    expect(snapshot.name).toBe('Lake x');
  });
});

describe('spotMapsUrls', () => {
  it('builds platform map URLs', () => {
    const urls = buildSpotMapsUrls({
      latitude: 37.669352,
      longitude: -121.841891,
      name: 'Shadow Cliffs',
    });
    expect(urls.appleDirections).toContain('37.669352');
    expect(urls.googleNavigation).toContain('37.669352');
    expect(urls.googleUniversal).toContain('travelmode=driving');
  });
});
