import { describe, expect, it } from 'vitest';
import {
  enrichRegionTileKey,
  snapCoordsToTileGrid,
} from '@/lib/api/endpoints/enrichRegion';

describe('enrichRegion', () => {
  it('snaps coordinates to 0.25 degree grid', () => {
    expect(snapCoordsToTileGrid(27.76, -82.64)).toEqual({ lat: 27.75, lon: -82.75 });
    expect(snapCoordsToTileGrid(37.12, -122.38)).toEqual({ lat: 37, lon: -122.5 });
  });

  it('builds stable tile cache keys', () => {
    expect(enrichRegionTileKey(27.76, -82.64)).toBe('27.75,-82.75');
    expect(enrichRegionTileKey(27.74, -82.66)).toBe('27.75,-82.75');
  });
});
