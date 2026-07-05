import { bffRequest } from '@/lib/api/client';
import { isBffEnabled } from '@/lib/api/config';

export interface TidePrediction {
  time: string;
  heightFeet: number;
  type: 'high' | 'low';
}

export interface TidesResponse {
  stationId: string;
  stationName: string;
  predictions: TidePrediction[];
}

/**
 * Tides route through the BFF only. NOAA CO-OPS requires resolving the nearest
 * tide station server-side before querying predictions — aggregation the BFF
 * exists to handle. Returns null until the BFF is deployed.
 */
export async function fetchTides(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<TidesResponse | null> {
  if (!isBffEnabled()) {
    return null;
  }

  try {
    return await bffRequest<TidesResponse>('/api/tides', {
      params: { lat: latitude, lon: longitude },
      signal,
    });
  } catch (error) {
    console.warn('BFF tides unavailable:', error);
    return null;
  }
}
