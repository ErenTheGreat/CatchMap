import { bffRequest } from '@/lib/api/client';
import { isBffEnabled } from '@/lib/api/config';
import bundledStations from '@/data/noaaTideStations.json';

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

interface TideStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface NoaaPredictionsResponse {
  predictions?: Array<{
    t: string;
    v: string;
    type: 'H' | 'L';
  }>;
  error?: { message: string };
}

const MAX_STATION_DISTANCE_KM = 75;
const NOAA_USER_AGENT = 'FishingApp/1.0 (tide-forecast)';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestStation(
  latitude: number,
  longitude: number
): { station: TideStation; distanceKm: number } | null {
  const stations = bundledStations as TideStation[];
  let nearest: { station: TideStation; distanceKm: number } | null = null;

  for (const station of stations) {
    const distanceKm = haversineKm(latitude, longitude, station.lat, station.lng);
    if (distanceKm > MAX_STATION_DISTANCE_KM) continue;
    if (!nearest || distanceKm < nearest.distanceKm) {
      nearest = { station, distanceKm };
    }
  }

  return nearest;
}

function formatNoaaDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

async function fetchNoaaPredictions(
  stationId: string,
  signal?: AbortSignal
): Promise<TidePrediction[]> {
  const begin = formatNoaaDate(new Date());
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 2);
  const end = formatNoaaDate(endDate);

  const url =
    `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?` +
    `product=predictions&station=${stationId}&begin_date=${begin}&end_date=${end}` +
    `&datum=MLLW&units=english&time_zone=lst_ldt&interval=hilo&format=json`;

  const response = await fetch(url, {
    signal,
    headers: { 'User-Agent': NOAA_USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`NOAA predictions error: ${response.status}`);
  }

  const data: NoaaPredictionsResponse = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }

  return (data.predictions ?? []).map((p) => ({
    time: p.t,
    heightFeet: parseFloat(p.v),
    type: p.type === 'H' ? 'high' : 'low',
  }));
}

async function fetchTidesFromNoaa(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<TidesResponse | null> {
  try {
    const nearest = findNearestStation(latitude, longitude);
    if (!nearest) return null;

    const predictions = await fetchNoaaPredictions(nearest.station.id, signal);
    if (predictions.length === 0) return null;

    return {
      stationId: nearest.station.id,
      stationName: nearest.station.name,
      predictions,
    };
  } catch (error) {
    if (__DEV__) console.warn('Direct NOAA tides unavailable:', error);
    return null;
  }
}

/**
 * BFF first when configured; falls back to bundled NOAA station lookup + predictions.
 */
export async function fetchTides(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<TidesResponse | null> {
  if (isBffEnabled()) {
    try {
      return await bffRequest<TidesResponse>('/api/tides', {
        params: { lat: latitude, lon: longitude },
        signal,
      });
    } catch (error) {
      if (__DEV__) console.warn('BFF tides unavailable, falling back to NOAA:', error);
    }
  }

  return fetchTidesFromNoaa(latitude, longitude, signal);
}
