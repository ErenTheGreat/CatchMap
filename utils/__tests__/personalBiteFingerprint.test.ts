import { describe, it, expect } from 'vitest';
import {
  buildPersonalBiteFingerprint,
  computePersonalPatternMatch,
  computePersonalBiteBoost,
  getHourBucketValue,
} from '@/utils/personalBiteFingerprint';
import type { CatchRecord } from '@/utils/storage';
import { MIN_CATCHES_FOR_FINGERPRINT } from '@/lib/types/personalBite';

function makeCatch(
  overrides: Partial<CatchRecord> & { id: string }
): CatchRecord {
  return {
    species: 'Largemouth Bass',
    speciesId: '1',
    weight: '2 lb',
    lure: 'Texas rig',
    notes: '',
    latitude: 34.0,
    longitude: -118.0,
    locationName: 'Test Lake',
    date: '2026-07-01',
    createdAt: new Date('2026-07-01T06:30:00').getTime(),
    ...overrides,
  };
}

describe('buildPersonalBiteFingerprint', () => {
  it('stays locked until enough conditioned catches', () => {
    const catches = Array.from({ length: MIN_CATCHES_FOR_FINGERPRINT - 1 }, (_, i) =>
      makeCatch({
        id: String(i),
        conditions: { pressureTrend: 'falling', skyLabel: 'Overcast' },
      })
    );
    const fp = buildPersonalBiteFingerprint(catches);
    expect(fp.unlocked).toBe(false);
    expect(fp.catchesUntilUnlock).toBe(1);
  });

  it('unlocks and surfaces top factors', () => {
    const catches: CatchRecord[] = [];
    for (let i = 0; i < 12; i++) {
      catches.push(
        makeCatch({
          id: String(i),
          createdAt: new Date(`2026-07-0${(i % 9) + 1}T06:30:00`).getTime(),
          conditions: {
            pressureTrend: i < 9 ? 'falling' : 'rising',
            skyLabel: i < 8 ? 'Overcast' : 'Clear',
            windSpeedMph: 8,
          },
        })
      );
    }
    const fp = buildPersonalBiteFingerprint(catches);
    expect(fp.unlocked).toBe(true);
    expect(fp.topFactors.length).toBeGreaterThan(0);
    expect(fp.topFactors[0]?.category).toBeDefined();
    expect(fp.headline).toContain('Your best fishing window');
  });

  it('builds per-species patterns with enough data', () => {
    const catches: CatchRecord[] = [];
    for (let i = 0; i < 6; i++) {
      catches.push(
        makeCatch({
          id: `bass-${i}`,
          species: 'Largemouth Bass',
          conditions: { pressureTrend: 'falling', skyLabel: 'Overcast' },
        })
      );
    }
    for (let i = 0; i < 10; i++) {
      catches.push(
        makeCatch({
          id: `other-${i}`,
          species: 'Rainbow Trout',
          conditions: { pressureTrend: 'stable', skyLabel: 'Clear' },
        })
      );
    }
    const fp = buildPersonalBiteFingerprint(catches);
    expect(fp.speciesPatterns.some((p) => p.species === 'Rainbow Trout')).toBe(true);
  });
});

describe('computePersonalPatternMatch', () => {
  it('scores higher when conditions align with fingerprint', () => {
    const catches = Array.from({ length: 12 }, (_, i) =>
      makeCatch({
        id: String(i),
        createdAt: new Date('2026-07-01T06:30:00').getTime(),
        conditions: {
          pressureTrend: 'falling',
          skyLabel: 'Overcast',
          windSpeedMph: 8,
        },
      })
    );
    const fp = buildPersonalBiteFingerprint(catches);

    const goodMatch = computePersonalPatternMatch(fp, {
      hour: 6,
      conditions: {
        pressureTrend: 'falling',
        skyLabel: 'Overcast',
        windSpeedMph: 8,
      },
    });

    const poorMatch = computePersonalPatternMatch(fp, {
      hour: 14,
      conditions: {
        pressureTrend: 'rising',
        skyLabel: 'Clear',
        windSpeedMph: 22,
      },
    });

    expect(goodMatch).toBeGreaterThan(poorMatch);
    expect(goodMatch).toBeGreaterThanOrEqual(30);
  });

  it('returns boost when match is strong', () => {
    const catches = Array.from({ length: 12 }, (_, i) =>
      makeCatch({
        id: String(i),
        createdAt: new Date('2026-07-01T06:30:00').getTime(),
        conditions: { pressureTrend: 'falling', skyLabel: 'Overcast' },
      })
    );
    const fp = buildPersonalBiteFingerprint(catches);
    const { boost, matchingFactors } = computePersonalBiteBoost(fp, {
      hour: 6,
      conditions: { pressureTrend: 'falling', skyLabel: 'Overcast' },
    });
    expect(boost).toBeGreaterThan(0);
    expect(matchingFactors.length).toBeGreaterThan(0);
  });
});

describe('getHourBucketValue', () => {
  it('maps dawn hours correctly', () => {
    expect(getHourBucketValue(6)).toBe('dawn');
    expect(getHourBucketValue(14)).toBe('midday');
    expect(getHourBucketValue(22)).toBe('night');
  });
});
