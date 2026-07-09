import type { BBox } from '@/lib/api/endpoints/spatialSpots';
import { normalizeViewportBounds } from '@/lib/api/endpoints/spatialSpots';

/** Seed data reference — Shadow Cliffs (migration 007) for bbox sanity checks. */
export const REFERENCE_LOCATION = {
  name: 'Shadow Cliffs Regional Recreation Area',
  lat: 37.669352,
  lng: -121.841891,
} as const;

/** Default discovery viewport — matches Bay Area seed data in migration 007. */
export const EAST_BAY_DISCOVERY_BBOX: BBox = [-122.15, 37.55, -121.7, 37.75];

export function bboxToLogCoords(bbox: BBox) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return { minLat, maxLat, minLng, maxLng };
}

export function bboxContainsPoint(
  bbox: BBox,
  lat: number,
  lng: number
): boolean {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

export function auditBBoxAgainstReference(bbox: BBox) {
  const coords = bboxToLogCoords(bbox);
  const containsReference = bboxContainsPoint(
    bbox,
    REFERENCE_LOCATION.lat,
    REFERENCE_LOCATION.lng
  );

  return {
    internalTuple: `[minLng=${bbox[0]}, minLat=${bbox[1]}, maxLng=${bbox[2]}, maxLat=${bbox[3]}]`,
    format: 'MapLibre [west, south, east, north] → [minLng, minLat, maxLng, maxLat]',
    coords,
    latSpan: coords.maxLat - coords.minLat,
    lngSpan: coords.maxLng - coords.minLng,
    referenceLocation: REFERENCE_LOCATION,
    referenceInsideBBox: containsReference,
  };
}

/**
 * Normalize map bounds, log for debugging, and optionally notify the viewport
 * sync pipeline (onRegionChangeComplete / moveend equivalent).
 */
export function reportMapRegionChangeComplete(
  raw: unknown,
  onViewportChange?: (bbox: BBox) => void
): BBox | null {
  if (__DEV__) {
    console.log('[FishingMap] Raw bounds from map:', raw);
  }

  const bbox = normalizeViewportBounds(raw);
  if (!bbox) {
    if (__DEV__) {
      console.warn('[FishingMap] Could not normalize viewport bounds:', raw);
    }
    return null;
  }

  if (__DEV__) {
    console.log('Current BBox:', bboxToLogCoords(bbox));
    console.log('[FishingMap] BBox audit:', auditBBoxAgainstReference(bbox));
  }

  onViewportChange?.(bbox);
  return bbox;
}

/** Log-only variant for in-progress camera moves (pan/zoom while dragging). */
export function logMapRegionChanging(raw: unknown): void {
  if (!__DEV__) return;
  console.log('[FishingMap] Raw bounds (moving):', raw);
  const bbox = normalizeViewportBounds(raw);
  if (!bbox) return;
  console.log('Current BBox:', bboxToLogCoords(bbox));
}
