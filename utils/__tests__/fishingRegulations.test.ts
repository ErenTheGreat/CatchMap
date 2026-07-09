import { describe, expect, it } from 'vitest';
import {
  getAreaRegulationNotices,
  getCatchRegulationCheck,
  getSpotRegulationNotices,
  getStateFromCoordinates,
  parseLengthToInches,
} from '@/utils/fishingRegulations';
import type { NearbySpot } from '@/utils/recommendations';

function makeSpot(lat: number, lon: number, waterType = 'lake'): NearbySpot {
  return {
    id: 'spot-test',
    name: 'Test Lake',
    description: null,
    latitude: lat,
    longitude: lon,
    water_type: waterType,
    species: [],
    facilities: [],
    best_months: [],
    rating: 4,
    created_at: '2026-01-01',
    distance: 1,
    matchedSpecies: [],
    isPeakSeason: false,
  };
}

describe('parseLengthToInches', () => {
  it('parses inches with unit', () => {
    expect(parseLengthToInches('18 in')).toBe(18);
    expect(parseLengthToInches('14.5 inches')).toBe(14.5);
  });

  it('parses centimeters', () => {
    expect(parseLengthToInches('45 cm')).toBeCloseTo(17.72, 1);
  });

  it('parses feet and inches', () => {
    expect(parseLengthToInches(`1'6"`)).toBe(18);
  });

  it('returns null for empty or unparseable input', () => {
    expect(parseLengthToInches('')).toBeNull();
    expect(parseLengthToInches('big')).toBeNull();
  });
});

describe('getCatchRegulationCheck', () => {
  it('prompts for location when coordinates are missing', () => {
    const check = getCatchRegulationCheck({
      latitude: null,
      longitude: null,
      speciesName: 'Largemouth Bass',
    });

    expect(check.notices.some((notice) => notice.id === 'catch-no-location')).toBe(true);
    expect(check.seasonStatus).toBe('unknown');
  });

  it('flags California bass below reference minimum size', () => {
    const check = getCatchRegulationCheck({
      latitude: 38.5,
      longitude: -121.5,
      speciesName: 'Largemouth Bass',
      waterType: 'lake',
      length: '10 in',
      month: 6,
    });

    expect(getStateFromCoordinates(38.5, -121.5)).toBe('CA');
    expect(check.seasonStatus).toBe('open');
    expect(check.bagLimit).toBe(5);
    expect(check.sizeCheck?.passes).toBe(false);
    expect(check.notices.some((notice) => notice.id === 'size-limit-Largemouth Bass')).toBe(true);
  });

  it('marks Oregon steelhead closed in summer months', () => {
    const check = getCatchRegulationCheck({
      latitude: 44.0,
      longitude: -123.5,
      speciesName: 'Steelhead',
      waterType: 'river',
      month: 7,
    });

    expect(getStateFromCoordinates(44.0, -123.5)).toBe('OR');
    expect(check.seasonStatus).toBe('closed');
    expect(check.notices.some((notice) => notice.id === 'season-closed-Steelhead')).toBe(true);
  });

  it('includes license reminder for known states', () => {
    const check = getCatchRegulationCheck({
      latitude: 38.5,
      longitude: -121.5,
      speciesName: 'Rainbow Trout',
      waterType: 'river',
      month: 3,
    });

    expect(check.notices.some((notice) => notice.id === 'license-CA')).toBe(true);
    expect(check.seasonStatus).toBe('open');
  });

  it('resolves Great Lakes states for license warnings', () => {
    expect(getStateFromCoordinates(43.0, -87.9)).toBe('WI');
    expect(getStateFromCoordinates(44.9, -85.5)).toBe('MI');

    const wisconsin = getAreaRegulationNotices(43.0, -87.9);
    expect(wisconsin.some((notice) => notice.id === 'license-WI')).toBe(true);
    expect(wisconsin.find((notice) => notice.id === 'license-WI')?.title).toContain('Wisconsin');

    const michiganSpot = getSpotRegulationNotices(makeSpot(44.9, -85.5, 'lake'));
    expect(michiganSpot.some((notice) => notice.id === 'license-MI')).toBe(true);
  });

  it('uses detailed California license copy when available', () => {
    const check = getCatchRegulationCheck({
      latitude: 37.8,
      longitude: -122.4,
      speciesName: 'Largemouth Bass',
      waterType: 'lake',
      month: 6,
    });

    const license = check.notices.find((notice) => notice.id === 'license-CA');
    expect(license?.message).toContain('California sport fishing license');
  });

  it('falls back outside US coverage', () => {
    const notices = getAreaRegulationNotices(51.5, 0.1);
    expect(notices.some((notice) => notice.id === 'fallback-regulations')).toBe(true);
  });
});
