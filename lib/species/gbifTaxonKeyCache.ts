import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@gbif_taxon_keys_v1';
const NEGATIVE_SENTINEL = -1;

const memory = new Map<string, number>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydratePromise) {
    await hydratePromise;
    return;
  }

  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Record<string, number>;
      for (const [scientificName, taxonKey] of Object.entries(parsed)) {
        if (typeof taxonKey === 'number') {
          memory.set(scientificName, taxonKey);
        }
      }
    } catch {
      // Ignore corrupt cache — GBIF lookups still work without it.
    } finally {
      hydrated = true;
    }
  })();

  await hydratePromise;
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const payload = Object.fromEntries(memory.entries());
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {});
  }, 400);
}

/** Returns a taxon key, null when GBIF has no match, or undefined when uncached. */
export async function getCachedTaxonKey(
  scientificName: string
): Promise<number | null | undefined> {
  await hydrate();

  if (!memory.has(scientificName)) {
    return undefined;
  }

  const value = memory.get(scientificName)!;
  return value === NEGATIVE_SENTINEL ? null : value;
}

export async function setCachedTaxonKey(
  scientificName: string,
  taxonKey: number | null
): Promise<void> {
  await hydrate();
  memory.set(scientificName, taxonKey ?? NEGATIVE_SENTINEL);
  schedulePersist();
}

/** Reset in-memory and persisted taxon keys — for tests only. */
export async function resetGbifTaxonKeyCache(): Promise<void> {
  memory.clear();
  hydrated = false;
  hydratePromise = null;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
}
