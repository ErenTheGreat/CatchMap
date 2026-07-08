import { describe, expect, it } from 'vitest';
import {
  getSpotLogSpeciesOptions,
  sortCatalogSpeciesByPreference,
} from '@/lib/species/spotLogSpecies';

describe('getSpotLogSpeciesOptions', () => {
  it('prefers scored predictions over raw availability', () => {
    expect(
      getSpotLogSpeciesOptions(
        [{ name: 'Rainbow Trout' }, { name: 'Largemouth Bass' }],
        [{ name: 'Bluegill' }]
      )
    ).toEqual(['Rainbow Trout', 'Largemouth Bass']);
  });

  it('falls back to available species when predictions are empty', () => {
    expect(
      getSpotLogSpeciesOptions([], [{ name: 'Striped Bass' }, { name: 'Bluegill' }])
    ).toEqual(['Striped Bass', 'Bluegill']);
  });

  it('deduplicates species names', () => {
    expect(
      getSpotLogSpeciesOptions(
        [{ name: 'Rainbow Trout' }, { name: 'Rainbow Trout' }],
        []
      )
    ).toEqual(['Rainbow Trout']);
  });
});

describe('sortCatalogSpeciesByPreference', () => {
  it('orders preferred species first while keeping the rest', () => {
    const catalog = [
      { name: 'Bluegill' },
      { name: 'Rainbow Trout' },
      { name: 'Largemouth Bass' },
    ];

    expect(
      sortCatalogSpeciesByPreference(catalog, ['Rainbow Trout', 'Largemouth Bass']).map(
        (item) => item.name
      )
    ).toEqual(['Rainbow Trout', 'Largemouth Bass', 'Bluegill']);
  });
});
