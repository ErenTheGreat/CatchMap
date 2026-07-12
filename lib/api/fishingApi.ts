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
 *   tides      /api/tides             NOAA CO-OPS via BFF or bundled station fallback
 *   species    /api/species           bundled species.json
 *   catches    (local-first)          Supabase + AsyncStorage
 */

import { fetchCategorizedSpotsInBBox } from '@/lib/api/endpoints/categorizedSpots';
import { fetchNearbyFishingSpots, FishingSpotsParams } from '@/lib/api/endpoints/fishingSpots';
import { fetchSpotsInBBox, BBox } from '@/lib/api/endpoints/spatialSpots';
import { fetchAccessPointsInBBox } from '@/lib/api/endpoints/accessPoints';
import { fetchSpotDetails } from '@/lib/api/endpoints/spotDetails';
import { fetchSpeciesAvailability, fetchSpeciesAvailabilityWithContext, fetchCatchActivityNearPoint } from '@/lib/api/endpoints/speciesPrediction';
import { fetchWeather, WeatherSnapshot } from '@/lib/api/endpoints/weather';
import { fetchTides, TidesResponse } from '@/lib/api/endpoints/tides';
import { fetchSpeciesCatalog, SpeciesRecord } from '@/lib/api/endpoints/speciesCatalog';
import { fetchEnrichRegion, EnrichRegionParams, EnrichRegionResult } from '@/lib/api/endpoints/enrichRegion';
import {
  getCatches,
  saveCatch,
  updateCatch,
  deleteCatch,
  clearAllCatches,
  syncPendingCatches,
  CatchRecord,
  SaveResult,
  SyncPendingResult,
  SaveCatchInput,
  UpdateCatchInput,
  type DeleteCatchResult,
} from '@/utils/storage';
import { NearbySpot } from '@/utils/osmFishingSpots';

export const fishingApi = {
  getNearbySpots(params: FishingSpotsParams): Promise<NearbySpot[]> {
    return fetchNearbyFishingSpots(params);
  },

  getCategorizedSpotsInBBox(bbox: BBox, signal?: AbortSignal) {
    return fetchCategorizedSpotsInBBox(bbox, signal);
  },

  /**
   * Global spatial query — documented fishing spots inside the current map
   * view, anywhere in the world. bbox is [minLon, minLat, maxLon, maxLat].
   */
  getSpotsInBBox(bbox: BBox, signal?: AbortSignal): Promise<NearbySpot[]> {
    return fetchSpotsInBBox(bbox, signal);
  },

  getAccessPointsInBBox(
    bbox: BBox,
    centerLat: number,
    centerLng: number,
    signal?: AbortSignal
  ): Promise<NearbySpot[]> {
    return fetchAccessPointsInBBox(bbox, centerLat, centerLng, signal);
  },

  getSpotDetails(
    latitude: number,
    longitude: number,
    spotId: string,
    signal?: AbortSignal
  ) {
    return fetchSpotDetails(latitude, longitude, spotId, signal);
  },

  getSpeciesAvailability(
    locationId: string | null,
    latitude: number | null,
    longitude: number | null,
    month?: number,
    signal?: AbortSignal
  ) {
    return fetchSpeciesAvailability(locationId, latitude, longitude, month, signal);
  },

  getSpeciesAvailabilityWithContext(
    locationId: string | null,
    latitude: number | null,
    longitude: number | null,
    month?: number,
    signal?: AbortSignal,
    spotName?: string | null,
    waterType?: string | null,
    offlineMode?: boolean
  ) {
    return fetchSpeciesAvailabilityWithContext(
      locationId,
      latitude,
      longitude,
      month,
      signal,
      spotName,
      waterType,
      offlineMode
    );
  },

  getCatchActivityNearPoint(
    latitude: number,
    longitude: number,
    radiusMeters?: number,
    daysBack?: number,
    signal?: AbortSignal
  ) {
    return fetchCatchActivityNearPoint(latitude, longitude, radiusMeters, daysBack, signal);
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

  enrichRegion(params: EnrichRegionParams, signal?: AbortSignal): Promise<EnrichRegionResult | null> {
    return fetchEnrichRegion(params, signal);
  },

  getCatches(): Promise<CatchRecord[]> {
    return getCatches();
  },

  saveCatch(catchData: SaveCatchInput): Promise<SaveResult> {
    return saveCatch(catchData);
  },

  updateCatch(id: string, changes: UpdateCatchInput): Promise<CatchRecord | null> {
    return updateCatch(id, changes);
  },

  deleteCatch(id: string): Promise<DeleteCatchResult> {
    return deleteCatch(id);
  },

  syncPendingCatches(): Promise<SyncPendingResult> {
    return syncPendingCatches();
  },

  clearLocalCatches(): Promise<void> {
    return clearAllCatches();
  },
};

export type { NearbySpot, WeatherSnapshot, TidesResponse, SpeciesRecord, CatchRecord, SaveResult, SyncPendingResult, SaveCatchInput, UpdateCatchInput, EnrichRegionResult, EnrichRegionParams };
export type { BBox };
