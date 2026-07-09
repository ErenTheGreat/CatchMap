import { describe, expect, it } from 'vitest';
import {
  MIN_DISCOVERY_SPOTS,
  SPARSE_EXPANSION_FACTORS,
  bboxSpanDegrees,
  expandBBoxCentered,
  sparseExpansionBboxes,
} from '@/lib/discovery/sparseRegionExpand';
import { isDiscoveryBBoxTooLarge } from '@/lib/api/endpoints/categorizedSpots';
import type { BBox } from '@/lib/api/endpoints/spatialSpots';

/** Rural Texas panhandle — historically sparse in tight viewports. */
const TEXAS_PANHANDLE: BBox = [-101.9, 35.1, -101.5, 35.4];

/** Lake Michigan nearshore — moderate density, benefits from modest expansion. */
const LAKE_MICHIGAN: BBox = [-87.2, 41.8, -86.8, 42.1];

describe('sparseRegionExpand', () => {
  it('exposes conservative discovery thresholds', () => {
    expect(MIN_DISCOVERY_SPOTS).toBeGreaterThanOrEqual(5);
    expect(SPARSE_EXPANSION_FACTORS).toEqual([2, 4, 8]);
  });

  it('computes bbox span in degrees', () => {
    const span = bboxSpanDegrees(TEXAS_PANHANDLE);
    expect(span.latSpan).toBeCloseTo(0.3, 5);
    expect(span.lngSpan).toBeCloseTo(0.4, 5);
  });

  it('expands symmetrically around the center', () => {
    const expanded = expandBBoxCentered(TEXAS_PANHANDLE, 2);
    const { latSpan, lngSpan } = bboxSpanDegrees(expanded);
    expect(latSpan).toBeCloseTo(0.6, 5);
    expect(lngSpan).toBeCloseTo(0.8, 5);

    const centerLat = (expanded[1] + expanded[3]) / 2;
    const centerLng = (expanded[0] + expanded[2]) / 2;
    expect(centerLat).toBeCloseTo(35.25, 5);
    expect(centerLng).toBeCloseTo(-101.7, 5);
  });

  it('returns progressive expansion steps until bbox cap', () => {
    const steps = sparseExpansionBboxes(LAKE_MICHIGAN);
    expect(steps.length).toBeGreaterThan(0);
    for (let i = 0; i < steps.length; i++) {
      const { latSpan, lngSpan } = bboxSpanDegrees(steps[i]);
      if (i > 0) {
        const prev = bboxSpanDegrees(steps[i - 1]);
        expect(latSpan).toBeGreaterThanOrEqual(prev.latSpan);
        expect(lngSpan).toBeGreaterThanOrEqual(prev.lngSpan);
      }
      expect(isDiscoveryBBoxTooLarge(steps[i])).toBe(false);
    }
  });

  it('stops before exceeding global discovery bbox limits', () => {
    const huge: BBox = [-120, 30, -118, 32];
    const steps = sparseExpansionBboxes(huge);
    for (const step of steps) {
      expect(isDiscoveryBBoxTooLarge(step)).toBe(false);
    }
  });
});
