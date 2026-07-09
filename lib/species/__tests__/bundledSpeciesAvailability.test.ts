import { describe, expect, it } from 'vitest';
import { fetchBundledSpeciesAvailability, getBundledSpotContext, findBundledSpot } from '@/lib/api/endpoints/bundledSpeciesAvailability';

const SHADOW_CLIFFS_ID = 'postgis-11111111-1111-4111-8111-000000000001';
const LAKE_DEL_VALLE_ID = 'postgis-11111111-1111-4111-8111-000000000002';
const CREEK_ID = 'postgis-11111111-1111-4111-8111-000000000007';

describe('fetchBundledSpeciesAvailability', () => {
  it('returns distinct species lists for Shadow Cliffs vs Lake Del Valle', () => {
    const shadowSpecies = fetchBundledSpeciesAvailability(SHADOW_CLIFFS_ID, 7);
    const delValleSpecies = fetchBundledSpeciesAvailability(LAKE_DEL_VALLE_ID, 7);

    const shadowNames = shadowSpecies.map((s) => s.name).sort();
    const delValleNames = delValleSpecies.map((s) => s.name).sort();

    expect(shadowNames).toEqual(['Channel Catfish', 'Largemouth Bass', 'Rainbow Trout']);
    expect(delValleNames).toEqual(['Bluegill', 'Kokanee Salmon', 'Smallmouth Bass', 'Striped Bass']);
    expect(shadowNames).not.toEqual(delValleNames);
  });

  it('enriches species with feeding zone and ideal temps from catalog', () => {
    const species = fetchBundledSpeciesAvailability(SHADOW_CLIFFS_ID, 7);
    const bass = species.find((s) => s.name === 'Largemouth Bass');

    expect(bass?.feedingZone).toBe('surface');
    expect(bass?.idealTempMin).not.toBeNull();
    expect(bass?.dataConfidence).toBe('high');
    expect(bass?.source).toBe('bundled');
  });

  it('returns creek-specific species for Arroyo del Valle', () => {
    const creekSpecies = fetchBundledSpeciesAvailability(CREEK_ID, 6);
    const names = creekSpecies.map((s) => s.name);

    expect(names).toContain('Green Sunfish');
    expect(names).not.toContain('Rainbow Trout');
  });

  it('provides spot context with depth and water type', () => {
    const spot = findBundledSpot(SHADOW_CLIFFS_ID);
    expect(spot).not.toBeNull();

    const context = getBundledSpotContext(spot!);
    expect(context.avgDepthFeet).toBe(24);
    expect(context.isSaltwater).toBe(false);
  });
});
