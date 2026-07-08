import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
    getAllKeys: vi.fn(async () => Array.from(storage.keys())),
    multiRemove: vi.fn(async (keys: string[]) => {
      for (const key of keys) storage.delete(key);
    }),
  },
}));

import {
  getCachedTaxonKey,
  resetGbifTaxonKeyCache,
  setCachedTaxonKey,
} from '@/lib/species/gbifTaxonKeyCache';
import {
  getCachedPresenceNearPoint,
  resetGbifPresenceCache,
  setCachedPresenceNearPoint,
} from '@/lib/species/gbifPresenceCache';
import { spotLikelyNeedsGbifLookup } from '@/lib/species/spotGbifLookup';

describe('gbifTaxonKeyCache', () => {
  beforeEach(async () => {
    storage.clear();
    await resetGbifTaxonKeyCache();
  });

  it('returns undefined for uncached names', async () => {
    expect(await getCachedTaxonKey('Oncorhynchus mykiss')).toBeUndefined();
  });

  it('stores resolved taxon keys in memory', async () => {
    await setCachedTaxonKey('Oncorhynchus mykiss', 123456);
    expect(await getCachedTaxonKey('Oncorhynchus mykiss')).toBe(123456);
  });

  it('hydrates taxon keys from AsyncStorage', async () => {
    storage.set('@gbif_taxon_keys_v1', JSON.stringify({ 'Oncorhynchus mykiss': 123456 }));
    expect(await getCachedTaxonKey('Oncorhynchus mykiss')).toBe(123456);
  });

  it('stores negative cache entries for unmatched names', async () => {
    await setCachedTaxonKey('Unknownus fishus', null);
    expect(await getCachedTaxonKey('Unknownus fishus')).toBeNull();
  });
});

describe('gbifPresenceCache', () => {
  beforeEach(async () => {
    storage.clear();
    await resetGbifPresenceCache();
  });

  it('round-trips presence results for a location and radius', async () => {
    const occurrences = [
      {
        scientificName: 'Micropterus salmoides',
        vernacularName: 'Largemouth Bass',
        speciesKey: 242,
        latitude: 37.5,
        longitude: -122.1,
      },
    ];

    await setCachedPresenceNearPoint(37.5012, -122.1034, 8, occurrences);
    expect(await getCachedPresenceNearPoint(37.5012, -122.1034, 8)).toEqual(occurrences);
  });

  it('uses rounded coordinates so nearby points share a cache bucket', async () => {
    await setCachedPresenceNearPoint(37.5012, -122.1034, 5, [
      {
        scientificName: 'Oncorhynchus mykiss',
        vernacularName: 'Rainbow Trout',
        speciesKey: 123,
        latitude: 37.5,
        longitude: -122.1,
      },
    ]);

    expect(await getCachedPresenceNearPoint(37.5014, -122.1032, 5)).toHaveLength(1);
  });
});

describe('spotLikelyNeedsGbifLookup', () => {
  it('returns true for bulk PostGIS locations', () => {
    expect(
      spotLikelyNeedsGbifLookup('postgis-22222222-2222-4222-8222-000000000002')
    ).toBe(true);
  });

  it('returns false for bundled curated spots', () => {
    expect(
      spotLikelyNeedsGbifLookup('postgis-11111111-1111-4111-8111-000000000001')
    ).toBe(false);
  });

  it('returns false when no location id is available', () => {
    expect(spotLikelyNeedsGbifLookup(null)).toBe(false);
  });
});
