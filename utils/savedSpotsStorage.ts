import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MAX_RECENT_SPOTS,
  MAX_SAVED_SPOTS,
  type RecentSpotSnapshot,
  type SavedSpotSnapshot,
  nearbySpotToSnapshot,
} from '@/lib/types/savedSpot';
import type { NearbySpot } from '@/utils/osmFishingSpots';

const SAVED_KEY = '@saved_spots_v1';
const RECENT_KEY = '@recent_spots_v1';

export async function loadSavedSpots(): Promise<SavedSpotSnapshot[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedSpotSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function loadRecentSpots(): Promise<RecentSpotSnapshot[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentSpotSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function persistSaved(spots: SavedSpotSnapshot[]): Promise<void> {
  await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(spots));
}

async function persistRecent(spots: RecentSpotSnapshot[]): Promise<void> {
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(spots));
}

export function upsertSavedSpot(
  spots: SavedSpotSnapshot[],
  spot: NearbySpot
): SavedSpotSnapshot[] {
  const snapshot = nearbySpotToSnapshot(spot);
  const without = spots.filter((item) => item.id !== snapshot.id);
  return [snapshot, ...without].slice(0, MAX_SAVED_SPOTS);
}

export function removeSavedSpot(
  spots: SavedSpotSnapshot[],
  spotId: string
): SavedSpotSnapshot[] {
  return spots.filter((spot) => spot.id !== spotId);
}

export function upsertRecentSpot(
  spots: RecentSpotSnapshot[],
  spot: NearbySpot
): RecentSpotSnapshot[] {
  const now = Date.now();
  const existing = spots.find((item) => item.id === spot.id);
  const snapshot: RecentSpotSnapshot = {
    ...nearbySpotToSnapshot(spot, existing?.savedAt ?? now),
    visitedAt: now,
  };
  const without = spots.filter((item) => item.id !== snapshot.id);
  return [snapshot, ...without].slice(0, MAX_RECENT_SPOTS);
}

export async function saveSavedSpots(spots: SavedSpotSnapshot[]): Promise<void> {
  await persistSaved(spots);
}

export async function saveRecentSpots(spots: RecentSpotSnapshot[]): Promise<void> {
  await persistRecent(spots);
}
