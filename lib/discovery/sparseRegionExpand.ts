import type { BBox } from '@/lib/api/endpoints/spatialSpots';
import { isDiscoveryBBoxTooLarge } from '@/lib/api/endpoints/categorizedSpots';

/** Minimum spots before we widen the search radius for rural / sparse regions. */
export const MIN_DISCOVERY_SPOTS = 8;

/** Progressive bbox multipliers — doubles span each step. */
export const SPARSE_EXPANSION_FACTORS = [2, 4, 8] as const;

/** Hard cap on expanded search span (degrees) to protect upstream RPCs. */
export const MAX_SPARSE_EXPANSION_SPAN_DEGREES = 2.5;

export function bboxSpanDegrees(bbox: BBox): { latSpan: number; lngSpan: number } {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return { latSpan: maxLat - minLat, lngSpan: maxLng - minLng };
}

/** Expand a bbox symmetrically around its center by a multiplier. */
export function expandBBoxCentered(bbox: BBox, factor: number): BBox {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const { latSpan, lngSpan } = bboxSpanDegrees(bbox);
  const nextLatSpan = Math.min(latSpan * factor, MAX_SPARSE_EXPANSION_SPAN_DEGREES);
  const nextLngSpan = Math.min(lngSpan * factor, MAX_SPARSE_EXPANSION_SPAN_DEGREES);
  return [
    centerLng - nextLngSpan / 2,
    centerLat - nextLatSpan / 2,
    centerLng + nextLngSpan / 2,
    centerLat + nextLatSpan / 2,
  ];
}

/** Bbox expansion steps for sparse-region discovery, smallest → largest. */
export function sparseExpansionBboxes(bbox: BBox): BBox[] {
  const expanded: BBox[] = [];
  for (const factor of SPARSE_EXPANSION_FACTORS) {
    const next = expandBBoxCentered(bbox, factor);
    if (isDiscoveryBBoxTooLarge(next)) break;
    expanded.push(next);
  }
  return expanded;
}
