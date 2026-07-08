import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GbifOccurrence } from '@/lib/species/gbifSpecies';

const STORAGE_PREFIX = '@gbif_presence_v1:';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface PresenceCacheEntry {
  expiresAt: number;
  occurrences: GbifOccurrence[];
}

const memory = new Map<string, PresenceCacheEntry>();
let hydratedKeys = new Set<string>();

function cacheKey(latitude: number, longitude: number, radiusKm: number): string {
  return `${latitude.toFixed(3)},${longitude.toFixed(3)},${radiusKm}`;
}

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

async function hydrateKey(key: string): Promise<void> {
  if (hydratedKeys.has(key)) return;

  hydratedKeys.add(key);
  try {
    const raw = await AsyncStorage.getItem(storageKey(key));
    if (!raw) return;

    const entry = JSON.parse(raw) as PresenceCacheEntry;
    if (entry.expiresAt > Date.now()) {
      memory.set(key, entry);
    } else {
      await AsyncStorage.removeItem(storageKey(key)).catch(() => {});
    }
  } catch {
    // Ignore corrupt cache entries.
  }
}

export async function getCachedPresenceNearPoint(
  latitude: number,
  longitude: number,
  radiusKm: number
): Promise<GbifOccurrence[] | undefined> {
  const key = cacheKey(latitude, longitude, radiusKm);
  await hydrateKey(key);

  const entry = memory.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    memory.delete(key);
    await AsyncStorage.removeItem(storageKey(key)).catch(() => {});
    return undefined;
  }

  return entry.occurrences;
}

export async function setCachedPresenceNearPoint(
  latitude: number,
  longitude: number,
  radiusKm: number,
  occurrences: GbifOccurrence[]
): Promise<void> {
  const key = cacheKey(latitude, longitude, radiusKm);
  const entry: PresenceCacheEntry = {
    expiresAt: Date.now() + TTL_MS,
    occurrences,
  };

  memory.set(key, entry);
  hydratedKeys.add(key);
  await AsyncStorage.setItem(storageKey(key), JSON.stringify(entry)).catch(() => {});
}

/** Reset presence cache — for tests only. */
export async function resetGbifPresenceCache(): Promise<void> {
  memory.clear();
  hydratedKeys = new Set();

  try {
    const keys = await AsyncStorage.getAllKeys();
    const presenceKeys = keys.filter((key) => key.startsWith(STORAGE_PREFIX));
    if (presenceKeys.length > 0) {
      await AsyncStorage.multiRemove(presenceKeys);
    }
  } catch {
    // Ignore storage errors in tests.
  }
}
