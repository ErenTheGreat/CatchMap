import { describe, expect, it } from 'vitest';
import { dedupeAvailableSpecies } from '@/lib/api/endpoints/speciesPrediction';
import type { AvailableSpecies } from '@/lib/types/speciesPrediction';

function species(id: string, name: string): AvailableSpecies {
  return {
    id,
    name,
    scientificName: name,
    imageUrl: null,
    feedingZone: 'mid',
    idealTempMin: null,
    idealTempMax: null,
    monthStart: 1,
    monthEnd: 12,
    source: 'location',
    dataConfidence: 'high',
  };
}

describe('dedupeAvailableSpecies', () => {
  it('removes duplicate ids and display names', () => {
    expect(
      dedupeAvailableSpecies([
        species('1', 'Rainbow Trout'),
        species('1', 'Rainbow Trout'),
        species('2', 'rainbow trout'),
        species('3', 'Largemouth Bass'),
      ]).map((item) => item.name)
    ).toEqual(['Rainbow Trout', 'Largemouth Bass']);
  });
});
