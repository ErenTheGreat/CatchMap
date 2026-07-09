import { NearbySpot } from '@/utils/osmFishingSpots';
import { BBox } from '@/lib/api/endpoints/spatialSpots';
import type { SpotDiscoveryScore } from '@/utils/spotDiscoveryScore';
import type { MapLayerState } from '@/lib/mapLayers/config';
import type { WaypointRecord } from '@/lib/types/waypoint';
import type { BiteHeatmapGeoJson } from '@/utils/biteHeatmap';

export interface MapLongPressCoords {
  latitude: number;
  longitude: number;
}

export interface FlyToTarget {
  lat: number;
  lng: number;
  key: number;
  zoom?: number;
}

/** Shared camera fly duration for search, spot selection, and recenter. */
export const MAP_FLY_TO_DURATION_MS = 1100;

export function flyToMatchesCenter(
  flyTo: FlyToTarget | null | undefined,
  latitude: number,
  longitude: number
): boolean {
  if (!flyTo) return false;
  return flyTo.lat === latitude && flyTo.lng === longitude;
}

export interface FishingMapProps {
  latitude: number;
  longitude: number;
  /** User/GPS marker when it should differ from the map view center (e.g. search fly-to). */
  userLatitude?: number;
  userLongitude?: number;
  nearbySpots: NearbySpot[];
  /** Real-time bite activity scores keyed by spot id for map pin coloring. */
  spotScores?: Record<string, SpotDiscoveryScore>;
  onSpotPress?: (spot: NearbySpot) => void;
  /** Fires when the camera finishes moving — [minLng, minLat, maxLng, maxLat] (onRegionChangeComplete equivalent) */
  onRegionChange?: (bbox: BBox) => void;
  /** When true, map camera flies to latitude/longitude when they change */
  recenterOnLocationChange?: boolean;
  /** Increment to force a camera flyTo even if lat/lon are unchanged */
  centerRequestKey?: number;
  /** Highlight the selected pin on the map */
  selectedSpotId?: string | null;
  /** Increment key to fly the camera to a spot without changing user location props */
  flyToTarget?: FlyToTarget | null;
  /** Fires when the user taps empty map area (dismiss keyboard / search) */
  onMapPress?: () => void;
  /** Toggle legend visibility from the layers FAB */
  showLegend?: boolean;
  /** Y offset so the legend clears the floating search header. */
  legendTopOffset?: number;
  /** Private user waypoints rendered as gold pins. */
  waypoints?: WaypointRecord[];
  onWaypointPress?: (waypoint: WaypointRecord) => void;
  /** Long-press on empty map to drop a private waypoint. */
  onMapLongPress?: (coords: MapLongPressCoords) => void;
  /** Optional raster overlays (depth contours, weather radar). */
  mapLayers?: MapLayerState;
  /** RainViewer raster tile URL template when radar layer is enabled. */
  radarTileUrl?: string | null;
  /** Bite probability heatmap GeoJSON when heatmap layer is enabled. */
  biteHeatmapGeoJson?: BiteHeatmapGeoJson | null;
}

export type { BiteHeatmapGeoJson } from '@/utils/biteHeatmap';

/**
 * Free, keyless vector styles (OpenStreetMap data served as vector tiles).
 * Used by both the native MapLibre view and the MapLibre GL JS fallback.
 */
export const VECTOR_LIGHT_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const VECTOR_DARK_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

/** @deprecated Use getVectorStyleUrl(isDark) for theme-aware basemaps. */
export const VECTOR_STYLE_URL = VECTOR_LIGHT_STYLE_URL;

export function getVectorStyleUrl(isDark: boolean, isOutdoor = false): string {
  if (isOutdoor || !isDark) return VECTOR_LIGHT_STYLE_URL;
  return VECTOR_DARK_STYLE_URL;
}
