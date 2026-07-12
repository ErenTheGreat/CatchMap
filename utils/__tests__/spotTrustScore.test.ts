import { describe, expect, it } from 'vitest';
import type { SavedSpotSnapshot } from '@/lib/types/savedSpot';
import type { TripFeedbackRecord } from '@/utils/tripFeedback';
import {
  computeSpotTrustScore,
  computeTrustBoost,
  buildTrustBoostBySpotId,
} from '@/utils/spotTrustScore';

function makeSpot(): SavedSpotSnapshot {
  return {
    id: 'lake-a',
    name: 'Lake Alpha',
    latitude: 40,
    longitude: -74,
    water_type: 'lake',
    savedAt: Date.now(),
  };
}

function makeRecord(outcome: TripFeedbackRecord['outcome'], predicted: number): TripFeedbackRecord {
  return {
    id: `${outcome}-${predicted}`,
    spotName: 'Lake Alpha',
    spotKey: 'Lake Alpha',
    windowStartIso: new Date().toISOString(),
    outcome,
    predictedRating: predicted,
    ratedAt: Date.now(),
  };
}

describe('spotTrustScore', () => {
  it('returns zero boost without enough samples', () => {
    expect(computeTrustBoost(100, 1)).toBe(0);
  });

  it('computes positive boost for high accuracy', () => {
    expect(computeTrustBoost(90, 3)).toBeGreaterThan(0);
  });

  it('computes spot trust from feedback records', () => {
    const spot = makeSpot();
    const records = [
      makeRecord('hot', 5),
      makeRecord('hot', 4),
      makeRecord('fair', 3),
    ];
    const trust = computeSpotTrustScore(spot, records);
    expect(trust.sampleSize).toBe(3);
    expect(trust.accuracyPct).toBeGreaterThan(0);
    expect(trust.label).toContain('%');
  });

  it('buildTrustBoostBySpotId maps saved spots', () => {
    const spot = makeSpot();
    const records = [makeRecord('hot', 5), makeRecord('hot', 4)];
    const boosts = buildTrustBoostBySpotId([spot], records);
    expect(boosts[spot.id]).toBeGreaterThanOrEqual(0);
  });
});
