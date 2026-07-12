import type { SavedSpotSnapshot } from '@/lib/types/savedSpot';
import {
  type TripFeedbackRecord,
  outcomeToNumeric,
} from '@/utils/tripFeedback';
import { buildTripReminderSpotKey } from '@/utils/tripReminders';

export const MIN_TRUST_SAMPLE = 2;
export const MAX_TRUST_BOOST = 0.25;
export const MIN_TRUST_BOOST = -0.15;

export interface SpotTrustResult {
  spotId: string;
  spotName: string;
  accuracyPct: number;
  sampleSize: number;
  boost: number;
  label: string;
}

function normalizeSpotName(name: string): string {
  return name.trim().toLowerCase();
}

function recordsForSpot(
  records: TripFeedbackRecord[],
  spotName: string
): TripFeedbackRecord[] {
  const key = buildTripReminderSpotKey(spotName);
  const normalized = normalizeSpotName(spotName);
  return records.filter(
    (record) =>
      record.spotKey === key || normalizeSpotName(record.spotName ?? '') === normalized
  );
}

export function computeTrustBoost(accuracyPct: number, sampleSize: number): number {
  if (sampleSize < MIN_TRUST_SAMPLE) return 0;
  const centered = (accuracyPct - 50) / 50;
  return Math.max(MIN_TRUST_BOOST, Math.min(MAX_TRUST_BOOST, centered * 0.2));
}

export function computeSpotTrustScore(
  spot: SavedSpotSnapshot,
  records: TripFeedbackRecord[]
): SpotTrustResult {
  const matched = recordsForSpot(records, spot.name).filter(
    (record) => record.predictedRating != null
  );

  if (matched.length === 0) {
    return {
      spotId: spot.id,
      spotName: spot.name,
      accuracyPct: 0,
      sampleSize: 0,
      boost: 0,
      label: 'Not enough trips rated',
    };
  }

  let accurateCount = 0;
  for (const record of matched) {
    const predicted = record.predictedRating ?? 3;
    const actual = outcomeToNumeric(record.outcome);
    if (Math.abs(predicted - actual) <= 1) accurateCount += 1;
  }

  const accuracyPct = Math.round((accurateCount / matched.length) * 100);
  const boost = computeTrustBoost(accuracyPct, matched.length);
  const label =
    matched.length < MIN_TRUST_SAMPLE
      ? `${matched.length} trip rated`
      : `${accuracyPct}% accurate for you`;

  return {
    spotId: spot.id,
    spotName: spot.name,
    accuracyPct,
    sampleSize: matched.length,
    boost,
    label,
  };
}

export function buildTrustBoostBySpotId(
  savedSpots: SavedSpotSnapshot[],
  records: TripFeedbackRecord[]
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const spot of savedSpots) {
    map[spot.id] = computeSpotTrustScore(spot, records).boost;
  }
  return map;
}

export function buildSpotTrustBySpotId(
  savedSpots: SavedSpotSnapshot[],
  records: TripFeedbackRecord[]
): Record<string, SpotTrustResult> {
  const map: Record<string, SpotTrustResult> = {};
  for (const spot of savedSpots) {
    map[spot.id] = computeSpotTrustScore(spot, records);
  }
  return map;
}
