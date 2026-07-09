import { describe, expect, it } from 'vitest';
import speciesData from '@/data/species.json';
import {
  matchSpeciesToCatalog,
  matchSpeciesToCatalogDetailed,
  SPECIES_CATALOG_NAMES,
} from '@/lib/species/matchSpeciesToCatalog';
import { SPECIES_CATALOG_NAMES as EDGE_CATALOG } from '../../../supabase/functions/_shared/speciesCatalog';

describe('matchSpeciesToCatalog', () => {
  it('keeps edge catalog in sync with species.json', () => {
    expect([...EDGE_CATALOG]).toEqual(speciesData.map((item) => item.name));
    expect(SPECIES_CATALOG_NAMES).toEqual(speciesData.map((item) => item.name));
  });

  it('matches exact catalog names', () => {
    expect(matchSpeciesToCatalog('Largemouth Bass')).toBe('Largemouth Bass');
    expect(matchSpeciesToCatalog('largemouth bass')).toBe('Largemouth Bass');
  });

  it('maps short aliases to catalog names', () => {
    expect(matchSpeciesToCatalog('Carp')).toBe('Common Carp');
    expect(matchSpeciesToCatalog('bass')).toBe('Largemouth Bass');
    expect(matchSpeciesToCatalog('Seatrout')).toBe('Spotted Seatrout');
  });

  it('strips markdown and quotes from model output', () => {
    expect(matchSpeciesToCatalog('```\nLargemouth Bass\n```')).toBe('Largemouth Bass');
    expect(matchSpeciesToCatalog('"Walleye"')).toBe('Walleye');
  });

  it('returns null for UNKNOWN', () => {
    expect(matchSpeciesToCatalog('UNKNOWN')).toBeNull();
  });

  it('returns provisional name for unknown sport fish', () => {
    const result = matchSpeciesToCatalogDetailed('Atlantic Cod');
    expect(result).toEqual({ name: 'Atlantic Cod', provisional: true });
    expect(matchSpeciesToCatalog('Atlantic Cod')).toBe('Atlantic Cod');
  });
});
