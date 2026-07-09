import { describe, expect, it } from 'vitest';
import { generateWaypointId, MAX_WAYPOINTS } from '@/lib/types/waypoint';
import {
  isLocalOnlyWaypoint,
  mergeWaypointsLocalAndRemote,
} from '@/utils/waypointsStorage';
import type { WaypointRecord } from '@/lib/types/waypoint';

function makeWaypoint(id: string, name = 'Spot'): WaypointRecord {
  const now = Date.now();
  return {
    id,
    name,
    notes: '',
    latitude: 37.5,
    longitude: -122.1,
    createdAt: now,
    updatedAt: now,
  };
}

describe('waypoint types', () => {
  it('generates unique client ids', () => {
    const first = generateWaypointId();
    const second = generateWaypointId();
    expect(first).toMatch(/^wp_/);
    expect(second).toMatch(/^wp_/);
    expect(first).not.toBe(second);
  });

  it('caps waypoint count', () => {
    expect(MAX_WAYPOINTS).toBeGreaterThan(0);
  });
});

describe('waypoint sync merge', () => {
  it('identifies local-only pending ids', () => {
    expect(isLocalOnlyWaypoint('wp_abc')).toBe(true);
    expect(isLocalOnlyWaypoint('uuid-from-cloud')).toBe(false);
  });

  it('keeps unsynced local waypoints when merging with cloud', () => {
    const pending = makeWaypoint('wp_pending', 'Offline spot');
    const remote = makeWaypoint('wp_synced', 'Cloud spot');

    const merged = mergeWaypointsLocalAndRemote([pending], [remote]);

    expect(merged).toHaveLength(2);
    expect(merged.map((w) => w.id)).toEqual(['wp_pending', 'wp_synced']);
  });

  it('drops pending local rows once they appear in cloud pull', () => {
    const pending = makeWaypoint('wp_synced', 'Now synced');
    const remote = makeWaypoint('wp_synced', 'Now synced');

    const merged = mergeWaypointsLocalAndRemote([pending], [remote]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('wp_synced');
  });

  it('respects MAX_WAYPOINTS cap', () => {
    const local = Array.from({ length: 3 }, (_, i) => makeWaypoint(`wp_local_${i}`));
    const remote = Array.from({ length: MAX_WAYPOINTS }, (_, i) =>
      makeWaypoint(`remote_${i}`)
    );

    const merged = mergeWaypointsLocalAndRemote(local, remote);

    expect(merged.length).toBeLessThanOrEqual(MAX_WAYPOINTS);
  });
});
