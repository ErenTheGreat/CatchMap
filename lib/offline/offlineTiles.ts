import { Platform } from 'react-native';
import { VECTOR_STYLE_URL } from '@/components/map/types';

/**
 * Offline vector tile packs via MapLibre's OfflineManager.
 * Only available in dev builds — Expo Go cannot load the native module,
 * so every entry point is guarded and reports unavailability instead of crashing.
 */

const PACK_NAME = 'primary-region';

const MILES_PER_DEGREE_LAT = 69;

export interface OfflineRegionStatus {
  state: 'inactive' | 'active' | 'complete';
  percentage: number;
  completedTileCount: number;
}

export type OfflineProgressCallback = (status: OfflineRegionStatus) => void;

interface OfflineManagerType {
  getPacks(): Promise<Array<{ id: string; metadata?: { name?: string } }>>;
  createPack(
    options: {
      mapStyle: string;
      bounds: [number, number, number, number];
      minZoom: number;
      maxZoom: number;
      metadata: { name: string; createdAt: number };
    },
    onProgress: (pack: unknown, status: OfflineRegionStatus) => void,
    onError: (pack: unknown, error: { message: string }) => void
  ): Promise<void>;
  deletePack(id: string): Promise<void>;
  removeListener(id: string): void;
}

function getOfflineManager(): OfflineManagerType | null {
  if (Platform.OS === 'web') return null;
  try {
    const { OfflineManager } = require('@maplibre/maplibre-react-native');
    return OfflineManager ?? null;
  } catch {
    return null;
  }
}

export function isOfflineMapsAvailable(): boolean {
  return getOfflineManager() !== null;
}

/** Bounding box as [west, south, east, north] around a center point */
function boundsAround(
  latitude: number,
  longitude: number,
  radiusMiles: number
): [number, number, number, number] {
  const dLat = radiusMiles / MILES_PER_DEGREE_LAT;
  const dLon =
    radiusMiles / (MILES_PER_DEGREE_LAT * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01));
  return [longitude - dLon, latitude - dLat, longitude + dLon, latitude + dLat];
}

async function findExistingPack(manager: OfflineManagerType) {
  const packs = await manager.getPacks();
  return packs.find((pack) => pack.metadata?.name === PACK_NAME) ?? null;
}

export async function getOfflineRegionStatus(): Promise<OfflineRegionStatus | null> {
  const manager = getOfflineManager();
  if (!manager) return null;

  const pack = await findExistingPack(manager);
  if (!pack) return null;

  const status = await pack.status();
  return {
    state: status.state,
    percentage: status.percentage,
    completedTileCount: status.completedTileCount,
  };
}

export async function downloadOfflineRegion(
  latitude: number,
  longitude: number,
  radiusMiles: number,
  onProgress: OfflineProgressCallback,
  onError: (message: string) => void
): Promise<void> {
  const manager = getOfflineManager();
  if (!manager) {
    onError('Offline maps require a development build.');
    return;
  }

  // Replace any previous region so there's a single managed pack
  const existing = await findExistingPack(manager);
  if (existing) {
    await manager.deletePack(existing.id);
  }

  await manager.createPack(
    {
      mapStyle: VECTOR_STYLE_URL,
      bounds: boundsAround(latitude, longitude, radiusMiles),
      minZoom: 8,
      maxZoom: 14,
      metadata: { name: PACK_NAME, createdAt: Date.now() },
    },
    (_pack, status) => {
      onProgress({
        state: status.state,
        percentage: status.percentage,
        completedTileCount: status.completedTileCount,
      });
    },
    (_pack, error) => {
      onError(error.message);
    }
  );
}

export async function removeOfflineRegion(): Promise<void> {
  const manager = getOfflineManager();
  if (!manager) return;

  const pack = await findExistingPack(manager);
  if (pack) {
    manager.removeListener(pack.id);
    await manager.deletePack(pack.id);
  }
}
