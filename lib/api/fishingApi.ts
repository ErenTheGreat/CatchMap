/**
 * fishingApi — the single data router for the mobile app.
 *
 * Every screen and hook talks to this module, never to fetch/supabase/OSM
 * directly. Each domain routes through the BFF proxy when configured
 * (EXPO_PUBLIC_BFF_URL) and degrades to a direct source otherwise:
 *
 *   Domain     BFF route              Fallback
 *   ---------  ---------------------  -------------------------------
 *   spots      /api/fishing-spots     bundled dataset + OSM + Supabase
 *   weather    /api/weather           Open-Meteo (keyless)
 *   tides      /api/tides             none (needs server-side NOAA station lookup)
 *   species    /api/species           bundled species.json
 *   catches    (local-first)          Supabase + AsyncStorage
 */

import { fetchNearbyFishingSpots, FishingSpotsParams } from '@/lib/api/endpoints/fishingSpots';
import { fetchSpotsInBBox, BBox } from '@/lib/api/endpoints/spatialSpots';
import { fetchWeather, WeatherSnapshot } from '@/lib/api/endpoints/weather';
import { fetchTides, TidesResponse } from '@/lib/api/endpoints/tides';
import { fetchSpeciesCatalog, SpeciesRecord } from '@/lib/api/endpoints/speciesCatalog';
import {
  getCatches,
  saveCatch,
  deleteCatch,
  CatchRecord,
} from '@/utils/storage';
import { NearbySpot } from '@/utils/osmFishingSpots';

export const fishingApi = {
  getNearbySpots(params: FishingSpotsParams): Promise<NearbySpot[]> {
    return fetchNearbyFishingSpots(params);
  },

  /**
   * Global spatial query — documented fishing spots inside the current map
   * view, anywhere in the world. bbox is [minLon, minLat, maxLon, maxLat].
   */
  getSpotsInBBox(bbox: BBox, signal?: AbortSignal): Promise<NearbySpot[]> {
    return fetchSpotsInBBox(bbox, signal);
  },

  getWeather(latitude: number, longitude: number, signal?: AbortSignal): Promise<WeatherSnapshot> {
    return fetchWeather(latitude, longitude, signal);
  },

  getTides(latitude: number, longitude: number, signal?: AbortSignal): Promise<TidesResponse | null> {
    return fetchTides(latitude, longitude, signal);
  },

  getSpeciesCatalog(latitude?: number, longitude?: number, signal?: AbortSignal): Promise<SpeciesRecord[]> {
    return fetchSpeciesCatalog(latitude, longitude, signal);
  },

  getCatches(): Promise<CatchRecord[]> {
    return getCatches();
  },

  saveCatch(catchData: Omit<CatchRecord, 'id' | 'createdAt'>): Promise<CatchRecord> {
    return saveCatch(catchData);
  },

  deleteCatch(id: string): Promise<void> {
    return deleteCatch(id);
  },
};

export type { NearbySpot, WeatherSnapshot, TidesResponse, SpeciesRecord, CatchRecord };
export type { BBox };
