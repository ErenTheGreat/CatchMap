import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/species/gbifCatalogPresence', () => ({
  fetchCatalogSpeciesPresenceNearPoint: vi.fn(),
}));

import { fetchSpeciesAvailabilityWithContext, getGbifSearchRadiusKm, filterVerifiedAvailabilityRows, isVerifiedSpeciesSource } from '@/lib/api/endpoints/speciesPrediction';
import { fetchCatalogSpeciesPresenceNearPoint } from '@/lib/species/gbifCatalogPresence';
import {
  buildGbifSpeciesList,
  findCatalogEntryByScientificName,
  matchGbifOccurrences,
  MAX_DISCOVERED_GBIF_SPECIES,
  normalizeScientificName,
} from '@/lib/species/matchGbifToCatalog';

const mockRpc = vi.mocked(supabase.rpc);
const mockFetchCatalogPresence = vi.mocked(fetchCatalogSpeciesPresenceNearPoint);

/** Cast vitest RPC mock results to Supabase's chainable builder type. */
function mockRpcResult(
  data: unknown,
  error: null | { message?: string } = null
): ReturnType<typeof supabase.rpc> {
  return Promise.resolve({ data, error }) as unknown as ReturnType<typeof supabase.rpc>;
}

describe('normalizeScientificName', () => {
  it('matches subspecies variants to binomial form', () => {
    expect(normalizeScientificName('Oncorhynchus mykiss irideus')).toBe('oncorhynchus mykiss');
    expect(normalizeScientificName('Micropterus salmoides floridanus')).toBe('micropterus salmoides');
  });

  it('finds catalog entries via normalized names', () => {
    const entry = findCatalogEntryByScientificName('Oncorhynchus mykiss irideus');
    expect(entry?.name).toBe('Rainbow Trout');
  });
});

describe('matchGbifOccurrences', () => {
  it('maps GBIF occurrences to catalog species with gbif source', () => {
    const result = matchGbifOccurrences([
      {
        scientificName: 'Oncorhynchus mykiss',
        vernacularName: 'Rainbow Trout',
        speciesKey: 123,
        latitude: 37.5,
        longitude: -122.1,
      },
      {
        scientificName: 'Micropterus salmoides',
        vernacularName: 'Largemouth Bass',
        speciesKey: 456,
        latitude: 37.5,
        longitude: -122.1,
      },
    ]);

    const names = result.catalog.map((item) => item.name).sort();
    expect(names).toEqual(['Largemouth Bass', 'Rainbow Trout']);
    expect(result.catalog.every((item) => item.source === 'gbif')).toBe(true);
    expect(result.catalog.every((item) => item.dataConfidence === 'medium')).toBe(true);
    expect(result.catalog.every((item) => item.inCatalog === true)).toBe(true);
    expect(result.discovered).toEqual([]);
  });

  it('includes undocumented GBIF species as gbif_discovered', () => {
    const result = matchGbifOccurrences([
      {
        scientificName: 'Ptychocheilus oregonensis',
        vernacularName: 'Northern Pikeminnow',
        speciesKey: 999,
        latitude: 37.5,
        longitude: -122.1,
      },
    ]);

    expect(result.catalog).toEqual([]);
    expect(result.discovered).toHaveLength(1);
    expect(result.discovered[0]?.name).toBe('Northern Pikeminnow');
    expect(result.discovered[0]?.source).toBe('gbif_discovered');
    expect(result.discovered[0]?.dataConfidence).toBe('low');
    expect(result.discovered[0]?.inCatalog).toBe(false);
  });

  it('caps undocumented species at MAX_DISCOVERED_GBIF_SPECIES', () => {
    const result = matchGbifOccurrences([
      {
        scientificName: 'Ptychocheilus oregonensis',
        vernacularName: 'Northern Pikeminnow',
        speciesKey: 1,
        latitude: 37.5,
        longitude: -122.1,
      },
      {
        scientificName: 'Catostomus macrocheilus',
        vernacularName: 'Largescale Sucker',
        speciesKey: 2,
        latitude: 37.5,
        longitude: -122.1,
      },
      {
        scientificName: 'Acrocheilus alutaceus',
        vernacularName: 'Chiselmouth',
        speciesKey: 3,
        latitude: 37.5,
        longitude: -122.1,
      },
    ]);

    expect(result.discovered).toHaveLength(MAX_DISCOVERED_GBIF_SPECIES);
  });

  it('buildGbifSpeciesList returns catalog matches before discoveries', () => {
    const list = buildGbifSpeciesList(
      matchGbifOccurrences([
        {
          scientificName: 'Ptychocheilus oregonensis',
          vernacularName: 'Northern Pikeminnow',
          speciesKey: 999,
          latitude: 37.5,
          longitude: -122.1,
        },
        {
          scientificName: 'Micropterus salmoides',
          vernacularName: 'Largemouth Bass',
          speciesKey: 456,
          latitude: 37.5,
          longitude: -122.1,
        },
      ])
    );

    expect(list.map((item) => item.name)).toEqual(['Largemouth Bass', 'Northern Pikeminnow']);
    expect(list[0]?.source).toBe('gbif');
    expect(list[1]?.source).toBe('gbif_discovered');
  });
});

describe('getGbifSearchRadiusKm', () => {
  it('uses a wider radius for lakes, ponds, and reservoirs', () => {
    expect(getGbifSearchRadiusKm('Shadow Cliffs Lake')).toBe(8);
    expect(getGbifSearchRadiusKm('Quarry Lakes (Horseshoe Lake)')).toBe(8);
    expect(getGbifSearchRadiusKm('Folsom Reservoir')).toBe(8);
    expect(getGbifSearchRadiusKm('Hidden Pond')).toBe(8);
  });

  it('uses the default creek radius for other water bodies', () => {
    expect(getGbifSearchRadiusKm('Arroyo del Valle Creek')).toBe(5);
    expect(getGbifSearchRadiusKm('Columbia River')).toBe(5);
    expect(getGbifSearchRadiusKm(null)).toBe(5);
  });
});

describe('verified species source helpers', () => {
  it('treats documented sources as verified', () => {
    expect(isVerifiedSpeciesSource('location')).toBe(true);
    expect(isVerifiedSpeciesSource('bundled')).toBe(true);
    expect(isVerifiedSpeciesSource('presence')).toBe(true);
    expect(isVerifiedSpeciesSource('gbif')).toBe(true);
    expect(isVerifiedSpeciesSource('gbif_discovered')).toBe(true);
  });

  it('rejects synthetic category sources', () => {
    expect(isVerifiedSpeciesSource('category')).toBe(false);
    expect(isVerifiedSpeciesSource(undefined)).toBe(false);
  });

  it('filters category rows out of RPC results', () => {
    const filtered = filterVerifiedAvailabilityRows([
      {
        species_id: '1',
        species_name: 'Largemouth Bass',
        scientific_name: 'Micropterus salmoides',
        image_url: null,
        feeding_zone: 'surface',
        ideal_temp_min: null,
        ideal_temp_max: null,
        month_start: 3,
        month_end: 10,
        source: 'category',
      },
      {
        species_id: '2',
        species_name: 'Green Sunfish',
        scientific_name: 'Lepomis cyanellus',
        image_url: null,
        feeding_zone: 'surface',
        ideal_temp_min: null,
        ideal_temp_max: null,
        month_start: 4,
        month_end: 10,
        source: 'presence',
      },
    ]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.species_name).toBe('Green Sunfish');
  });
});

describe('fetchSpeciesAvailabilityWithContext', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFetchCatalogPresence.mockReset();
  });

  it('uses RPC results directly when sources are not category-only', async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'get_species_availability_for_location') {
        return mockRpcResult([
            {
              species_id: '11111111-1111-4111-8111-000000000099',
              species_name: 'Green Sunfish',
              scientific_name: 'Lepomis cyanellus',
              feeding_zone: 'surface',
              month_start: 4,
              month_end: 10,
              source: 'location',
            },
          ]);
      }

      return mockRpcResult([]);
    });

    const result = await fetchSpeciesAvailabilityWithContext(
      'postgis-11111111-1111-4111-8111-000000000099',
      37.68,
      -121.77,
      7
    );

    expect(result.species.map((item) => item.name)).toEqual(['Green Sunfish']);
    expect(result.species[0]?.source).toBe('location');
    // Bulk PostGIS ids may start GBIF in parallel; curated location rows still win.
    expect(mockFetchCatalogPresence).toHaveBeenCalled();
  });

  it('uses GBIF when RPC returns only category fallback rows', async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'get_species_availability_for_location') {
        return mockRpcResult([
            {
              species_id: 'cat-1',
              species_name: 'Largemouth Bass',
              scientific_name: 'Micropterus salmoides',
              feeding_zone: 'surface',
              month_start: 3,
              month_end: 10,
              source: 'category',
            },
            {
              species_id: 'cat-2',
              species_name: 'Rainbow Trout',
              scientific_name: 'Oncorhynchus mykiss',
              feeding_zone: 'mid',
              month_start: 1,
              month_end: 12,
              source: 'category',
            },
          ]);
      }

      return mockRpcResult([]);
    });

    mockFetchCatalogPresence.mockResolvedValue([
      {
        scientificName: 'Oncorhynchus mykiss',
        vernacularName: 'Rainbow Trout',
        speciesKey: 789,
        latitude: 41.2,
        longitude: -73.1,
      },
    ]);

    const result = await fetchSpeciesAvailabilityWithContext(
      'postgis-22222222-2222-4222-8222-000000000002',
      41.2,
      -73.1,
      7
    );

    expect(result.species.map((item) => item.name)).toEqual(['Rainbow Trout']);
    expect(result.species[0]?.source).toBe('gbif');
    expect(result.spotContext?.isSaltwater).toBe(false);
    expect(mockFetchCatalogPresence).toHaveBeenCalledWith(41.2, -73.1, 5, undefined);
  });

  it('returns empty when GBIF returns no matches and RPC has only category rows', async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'get_species_availability_for_location') {
        return mockRpcResult([
            {
              species_id: 'cat-1',
              species_name: 'Largemouth Bass',
              scientific_name: 'Micropterus salmoides',
              feeding_zone: 'surface',
              month_start: 3,
              month_end: 10,
              source: 'category',
            },
          ]);
      }

      return mockRpcResult([]);
    });

    mockFetchCatalogPresence.mockResolvedValue([]);

    const result = await fetchSpeciesAvailabilityWithContext(
      'postgis-33333333-3333-4333-8333-000000000003',
      40.0,
      -120.0,
      7
    );

    expect(result.species).toEqual([]);
    expect(result.spotContext).toBeNull();
  });

  it('uses GBIF with an 8km radius for lakes when category fallback is returned', async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'get_species_availability_for_location') {
        return mockRpcResult([
            {
              species_id: 'lake-cat-1',
              species_name: 'Largemouth Bass',
              scientific_name: 'Micropterus salmoides',
              feeding_zone: 'surface',
              month_start: 3,
              month_end: 10,
              source: 'category',
            },
            {
              species_id: 'lake-cat-2',
              species_name: 'Bluegill',
              scientific_name: 'Lepomis macrochirus',
              feeding_zone: 'surface',
              month_start: 4,
              month_end: 10,
              source: 'category',
            },
          ]);
      }

      return mockRpcResult([]);
    });

    mockFetchCatalogPresence.mockResolvedValue([
      {
        scientificName: 'Micropterus dolomieu',
        vernacularName: 'Smallmouth Bass',
        speciesKey: 321,
        latitude: 37.69,
        longitude: -121.84,
      },
    ]);

    const result = await fetchSpeciesAvailabilityWithContext(
      'postgis-44444444-4444-4444-8444-000000000004',
      37.69,
      -121.84,
      7,
      undefined,
      'Shadow Cliffs Lake'
    );

    expect(result.species.map((item) => item.name)).toEqual(['Smallmouth Bass']);
    expect(result.species[0]?.source).toBe('gbif');
    expect(mockFetchCatalogPresence).toHaveBeenCalledWith(37.69, -121.84, 8, undefined);
  });

  it('expands GBIF search radius when the first pass returns nothing', async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'get_species_availability_for_location') {
        return mockRpcResult([
            {
              species_id: 'lake-cat-1',
              species_name: 'Striped Bass',
              scientific_name: 'Morone saxatilis',
              feeding_zone: 'mid',
              month_start: 4,
              month_end: 11,
              source: 'category',
            },
          ]);
      }

      return mockRpcResult([]);
    });

    mockFetchCatalogPresence
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          scientificName: 'Morone saxatilis',
          vernacularName: 'Striped Bass',
          speciesKey: 555,
          latitude: 38.0,
          longitude: -121.5,
        },
      ]);

    const result = await fetchSpeciesAvailabilityWithContext(
      'postgis-55555555-5555-4555-8555-000000000005',
      38.0,
      -121.5,
      7,
      undefined,
      'Remote Mountain Lake'
    );

    expect(result.species.map((item) => item.name)).toEqual(['Striped Bass']);
    expect(result.species[0]?.source).toBe('gbif');
    expect(mockFetchCatalogPresence).toHaveBeenNthCalledWith(1, 38.0, -121.5, 8, undefined);
    expect(mockFetchCatalogPresence).toHaveBeenNthCalledWith(2, 38.0, -121.5, 16, undefined);
  });

  it('returns discovered GBIF species when nothing is in the catalog', async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === 'get_species_availability_for_location') {
        return mockRpcResult([
            {
              species_id: 'cat-1',
              species_name: 'Largemouth Bass',
              scientific_name: 'Micropterus salmoides',
              feeding_zone: 'surface',
              month_start: 3,
              month_end: 10,
              source: 'category',
            },
          ]);
      }

      return mockRpcResult([]);
    });

    mockFetchCatalogPresence.mockResolvedValue([
      {
        scientificName: 'Ptychocheilus oregonensis',
        vernacularName: 'Northern Pikeminnow',
        speciesKey: 888,
        latitude: 45.0,
        longitude: -122.0,
      },
    ]);

    const result = await fetchSpeciesAvailabilityWithContext(
      'postgis-66666666-6666-4666-8666-000000000006',
      45.0,
      -122.0,
      7
    );

    expect(result.species.map((item) => item.name)).toEqual(['Northern Pikeminnow']);
    expect(result.species[0]?.source).toBe('gbif_discovered');
    expect(result.species[0]?.dataConfidence).toBe('low');
  });
});
