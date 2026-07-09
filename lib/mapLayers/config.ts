/** Map overlay layer configuration (depth contours, weather radar). */

export type MapOverlayLayerId = 'depth' | 'radar' | 'heatmap' | 'community';

export interface MapLayerState {
  depth: boolean;
  radar: boolean;
  heatmap: boolean;
  community: boolean;
}

export const DEFAULT_MAP_LAYER_STATE: MapLayerState = {
  depth: false,
  radar: false,
  heatmap: false,
  community: false,
};

/** NOAA bathymetry only serves low zooms — requesting higher zooms shows error tiles on the map. */
export const DEPTH_MIN_ZOOM = 3;
export const DEPTH_MAX_ZOOM = 10;

/** RainViewer free tier serves native tiles through zoom 7; higher map zooms overzoom these tiles. */
export const RADAR_MIN_ZOOM = 0;
export const RADAR_TILE_MAX_ZOOM = 7;
/** @deprecated Use RADAR_TILE_MAX_ZOOM — kept for imports during migration. */
export const RADAR_MAX_ZOOM = RADAR_TILE_MAX_ZOOM;

/**
 * NOAA ArcGIS public shallow-water bathymetry (Web Mercator tiles).
 * Free for non-commercial use; full Navionics/C-Map licensing is a future Pro tier.
 */
export const DEPTH_TILE_URL =
  'https://tiles.arcgis.com/tiles/C8PHGorlYSStWskQ/arcgis/rest/services/Specialty_Bathymetric_3857/MapServer/tile/{z}/{y}/{x}';

export const DEPTH_TILE_ATTRIBUTION = 'NOAA / Esri Bathymetry';

export interface RadarFrame {
  path: string;
  time: number;
}

export interface RainViewerMapsResponse {
  host?: string;
  radar?: {
    past?: RadarFrame[];
  };
}

export interface RadarTileConfig {
  host: string;
  path: string;
}

const DEFAULT_RADAR_HOST = 'https://tilecache.rainviewer.com';

export async function fetchLatestRadarFrame(
  signal?: AbortSignal
): Promise<RadarTileConfig | null> {
  const response = await fetch('https://api.rainviewer.com/public/weather-maps.json', { signal });
  if (!response.ok) return null;

  const data = (await response.json()) as RainViewerMapsResponse;
  const frames = data.radar?.past;
  if (!frames?.length) return null;

  const path = frames[frames.length - 1]?.path;
  if (!path) return null;

  return {
    host: data.host ?? DEFAULT_RADAR_HOST,
    path,
  };
}

/** @deprecated Use fetchLatestRadarFrame */
export async function fetchLatestRadarPath(signal?: AbortSignal): Promise<string | null> {
  const frame = await fetchLatestRadarFrame(signal);
  return frame?.path ?? null;
}

/** Build RainViewer raster tile URL template (MapLibre substitutes {z}/{x}/{y}). */
export function buildRadarTileUrl(
  radarPath: string,
  host: string = DEFAULT_RADAR_HOST
): string {
  const normalizedHost = host.replace(/\/$/, '');
  return `${normalizedHost}${radarPath}/256/{z}/{x}/{y}/2/1_1.png`;
}
