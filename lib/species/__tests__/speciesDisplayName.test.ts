import { describe, expect, it } from 'vitest';
import {
  isNonFishScientificName,
  isUserFriendlySpeciesName,
  looksLikeLatinBinomial,
  vernacularNameFromOccurrence,
} from '@/lib/species/speciesDisplayName';
import { matchGbifOccurrences } from '@/lib/species/matchGbifToCatalog';

describe('speciesDisplayName', () => {
  it('detects Latin binomials', () => {
    expect(looksLikeLatinBinomial('Cancer productus')).toBe(true);
    expect(looksLikeLatinBinomial('Largemouth Bass')).toBe(false);
    expect(looksLikeLatinBinomial('Northern Pikeminnow')).toBe(false);
  });

  it('rejects Latin binomials for user-facing names', () => {
    expect(isUserFriendlySpeciesName('Cancer productus')).toBe(false);
    expect(isUserFriendlySpeciesName('Red Rock Crab')).toBe(true);
  });

  it('flags crab genera as non-fish', () => {
    expect(isNonFishScientificName('Cancer productus')).toBe(true);
    expect(isNonFishScientificName('Micropterus salmoides')).toBe(false);
  });

  it('requires a vernacular name for discovered species display', () => {
    expect(vernacularNameFromOccurrence(null, 'Cancer productus')).toBeNull();
    expect(
      vernacularNameFromOccurrence('Red Rock Crab', 'Cancer productus')
    ).toBe('Red Rock Crab');
    expect(vernacularNameFromOccurrence(null, 'Ptychocheilus oregonensis')).toBeNull();
  });
});

describe('matchGbifOccurrences crab filter', () => {
  it('excludes Cancer productus when only scientific name is available', () => {
    const result = matchGbifOccurrences([
      {
        scientificName: 'Cancer productus',
        vernacularName: null,
        speciesKey: 12345,
        latitude: 37.5,
        longitude: -122.1,
      },
    ]);

    expect(result.catalog).toEqual([]);
    expect(result.discovered).toEqual([]);
  });

  it('still includes fish with proper common names', () => {
    const result = matchGbifOccurrences([
      {
        scientificName: 'Ptychocheilus oregonensis',
        vernacularName: 'Northern Pikeminnow',
        speciesKey: 999,
        latitude: 37.5,
        longitude: -122.1,
      },
    ]);

    expect(result.discovered).toHaveLength(1);
    expect(result.discovered[0]?.name).toBe('Northern Pikeminnow');
  });
});
