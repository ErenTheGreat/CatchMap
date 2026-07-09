export type CoordinateSource = 'gps' | 'search';

export interface ActiveCoordinates {
  latitude: number;
  longitude: number;
  source: CoordinateSource;
  /** Human-readable label when source is a searched location */
  label?: string;
}

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  isDefault: boolean;
  permissionDenied: boolean;
}

export interface LocationSearchResult {
  id: string;
  name: string;
  waterType: 'saltwater' | 'freshwater' | 'brackish';
  latitude: number;
  longitude: number;
}

/** Row shape returned by the `search_fishing_spots` RPC. */
export interface SearchFishingSpotsRow {
  id: string;
  name: string;
  water_type: 'saltwater' | 'freshwater' | 'brackish';
  latitude: number;
  longitude: number;
}
