import { describe, expect, it } from 'vitest';
import { buildCatchCoachAdvice } from '@/utils/catchCoach';
import type { CatchRecord } from '@/utils/storage';

describe('buildCatchCoachAdvice', () => {
  it('returns null when species name is empty', () => {
    expect(buildCatchCoachAdvice({ speciesName: '' })).toBeNull();
  });

  it('builds catalog-based advice without location', () => {
    const advice = buildCatchCoachAdvice({ speciesName: 'Largemouth Bass' });
    expect(advice).not.toBeNull();
    expect(advice?.speciesName).toBe('Largemouth Bass');
    expect(advice?.setup.rigName).toBeTruthy();
    expect(advice?.setup.lureLabel).toBeTruthy();
    expect(advice?.hasCatalogData).toBe(true);
    expect(advice?.confidence).toBe('low');
  });

  it('includes community intel when rows match species', () => {
    const advice = buildCatchCoachAdvice({
      speciesName: 'Largemouth Bass',
      latitude: 37.87,
      longitude: -122.27,
      communityRows: [
        {
          speciesId: '1',
          speciesName: 'Largemouth Bass',
          catchCount: 5,
          topLures: ['Texas rig worm'],
        },
      ],
    });
    expect(advice?.community?.catchCount).toBe(5);
    expect(advice?.community?.topLures[0]).toBe('Texas rig worm');
    expect(advice?.confidence).toBe('high');
  });

  it('includes personal patterns when enough history exists', () => {
    const catches: CatchRecord[] = [
      {
        id: '1',
        species: 'Largemouth Bass',
        speciesId: '1',
        weight: '4',
        lure: 'Jig',
        notes: '',
        latitude: 37.87,
        longitude: -122.27,
        locationName: 'Lake',
        date: '1/1/2026',
        createdAt: new Date('2026-01-01T14:00:00').getTime(),
      },
      {
        id: '2',
        species: 'Largemouth Bass',
        speciesId: '1',
        weight: '3',
        lure: 'Jig',
        notes: '',
        latitude: 37.87,
        longitude: -122.27,
        locationName: 'Lake',
        date: '2/1/2026',
        createdAt: new Date('2026-02-01T15:00:00').getTime(),
      },
      {
        id: '3',
        species: 'Rainbow Trout',
        speciesId: '2',
        weight: '2',
        lure: 'Spinner',
        notes: '',
        latitude: 37.87,
        longitude: -122.27,
        locationName: 'Lake',
        date: '3/1/2026',
        createdAt: new Date('2026-03-01T10:00:00').getTime(),
      },
    ];

    const advice = buildCatchCoachAdvice({
      speciesName: 'Largemouth Bass',
      latitude: 37.87,
      longitude: -122.27,
      catches,
    });

    expect(advice?.personal?.topLure).toBe('Jig');
    expect(advice?.personal?.message).toContain('Jig');
    expect(advice?.confidence).toBe('high');
  });

  it('handles unknown species gracefully', () => {
    const advice = buildCatchCoachAdvice({
      speciesName: 'Mystery Fish',
      latitude: 40,
      longitude: -100,
    });
    expect(advice).not.toBeNull();
    expect(advice?.hasCatalogData).toBe(false);
    expect(advice?.confidence).toBe('low');
  });
});
