import { describe, expect, it } from 'vitest';
import {
  fetchOfflineCategorySpecies,
  fetchOfflineCategorySpeciesForSpot,
  inferLocationCategory,
} from '@/lib/species/offlineCategorySpecies';

describe('inferLocationCategory', () => {
  it('classifies creeks and rivers as Rivers & Creeks', () => {
    expect(inferLocationCategory('Arroyo del Valle Creek', 'stream')).toBe('Rivers & Creeks');
    expect(inferLocationCategory('Columbia River', null)).toBe('Rivers & Creeks');
  });

  it('classifies lakes and ponds as Lakes & Ponds', () => {
    expect(inferLocationCategory('Shadow Cliffs Lake', 'lake')).toBe('Lakes & Ponds');
    expect(inferLocationCategory('Hidden Pond', null)).toBe('Lakes & Ponds');
  });

  it('classifies bays and coastal water as Bays & Oceans', () => {
    expect(inferLocationCategory('San Francisco Bay', 'saltwater')).toBe('Bays & Oceans');
  });
});

describe('fetchOfflineCategorySpecies', () => {
  it('returns creek defaults without saltwater species', () => {
    const names = fetchOfflineCategorySpecies('Rivers & Creeks', 6).map((item) => item.name);
    expect(names).toContain('Green Sunfish');
    expect(names).not.toContain('California Halibut');
    expect(names).not.toContain('Striped Bass');
  });

  it('returns lake defaults with striped bass but not halibut', () => {
    const names = fetchOfflineCategorySpecies('Lakes & Ponds', 7).map((item) => item.name);
    expect(names).toContain('Striped Bass');
    expect(names).not.toContain('California Halibut');
  });

  it('infers category from spot metadata', () => {
    const result = fetchOfflineCategorySpeciesForSpot('Quarry Lakes', 'lake', 7);
    expect(result.species.map((item) => item.name)).toContain('Largemouth Bass');
    expect(result.spotContext.isSaltwater).toBe(false);
  });
});
