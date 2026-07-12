import AsyncStorage from '@react-native-async-storage/async-storage';

export type TripOutcomeRating = 'slow' | 'fair' | 'hot';

export interface TripFeedbackRecord {
  id: string;
  spotName?: string;
  spotKey: string;
  windowStartIso: string;
  windowEndIso?: string;
  predictedRating?: number;
  /** User-rated outcome. */
  outcome: TripOutcomeRating;
  ratedAt: number;
  sharedAnonymously?: boolean;
}

export interface TripFeedbackStats {
  totalRated: number;
  accurateCount: number;
  accuracyPct: number;
}

const FEEDBACK_KEY = '@trip_feedback_v1';
const PENDING_PROMPT_KEY = '@trip_feedback_pending_v1';

export function outcomeToNumeric(outcome: TripOutcomeRating): number {
  switch (outcome) {
    case 'slow':
      return 1;
    case 'fair':
      return 3;
    case 'hot':
      return 5;
  }
}

export async function loadTripFeedbackRecords(): Promise<TripFeedbackRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(FEEDBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TripFeedbackRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function persistTripFeedbackRecords(records: TripFeedbackRecord[]): Promise<void> {
  await AsyncStorage.setItem(FEEDBACK_KEY, JSON.stringify(records.slice(0, 50)));
}

export async function saveTripFeedback(record: TripFeedbackRecord): Promise<void> {
  const existing = await loadTripFeedbackRecords();
  await persistTripFeedbackRecords([record, ...existing.filter((r) => r.id !== record.id)]);
  await clearPendingTripFeedbackPrompt();
}

export interface PendingTripFeedbackPrompt {
  spotName?: string;
  spotKey: string;
  windowStartIso: string;
  windowEndIso?: string;
  predictedRating?: number;
}

export async function loadPendingTripFeedbackPrompt(): Promise<PendingTripFeedbackPrompt | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_PROMPT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingTripFeedbackPrompt;
  } catch {
    return null;
  }
}

export async function setPendingTripFeedbackPrompt(
  prompt: PendingTripFeedbackPrompt
): Promise<void> {
  await AsyncStorage.setItem(PENDING_PROMPT_KEY, JSON.stringify(prompt));
}

export async function clearPendingTripFeedbackPrompt(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_PROMPT_KEY);
}

/** Mark a completed trip window as needing feedback (called when window ends). */
export async function queueTripFeedbackIfDue(
  windowEndIso: string | undefined,
  spotKey: string,
  spotName?: string,
  windowStartIso?: string,
  predictedRating?: number
): Promise<void> {
  if (!windowEndIso || !windowStartIso) return;

  const windowEnd = new Date(windowEndIso).getTime();
  if (Date.now() < windowEnd) return;

  const existing = await loadPendingTripFeedbackPrompt();
  if (existing?.spotKey === spotKey && existing.windowStartIso === windowStartIso) return;

  const records = await loadTripFeedbackRecords();
  const alreadyRated = records.some(
    (r) => r.spotKey === spotKey && r.windowStartIso === windowStartIso
  );
  if (alreadyRated) return;

  await setPendingTripFeedbackPrompt({
    spotKey,
    spotName,
    windowStartIso,
    windowEndIso,
    predictedRating,
  });
}

export function computeTripFeedbackStats(records: TripFeedbackRecord[]): TripFeedbackStats {
  const rated = records.filter((r) => r.predictedRating != null);
  if (rated.length === 0) {
    return { totalRated: records.length, accurateCount: 0, accuracyPct: 0 };
  }

  let accurateCount = 0;
  for (const record of rated) {
    const predicted = record.predictedRating ?? 3;
    const actual = outcomeToNumeric(record.outcome);
    if (Math.abs(predicted - actual) <= 1) accurateCount += 1;
  }

  return {
    totalRated: rated.length,
    accurateCount,
    accuracyPct: Math.round((accurateCount / rated.length) * 100),
  };
}

/** Calibration weights derived from feedback — boosts factors that correlated with hot trips. */
export function getFeedbackCalibrationBoost(
  records: TripFeedbackRecord[],
  factorCategory: string
): number {
  const hot = records.filter((r) => r.outcome === 'hot').length;
  const slow = records.filter((r) => r.outcome === 'slow').length;
  if (hot + slow < 3) return 0;

  const ratio = hot / (hot + slow);
  if (factorCategory === 'pressureTrend' && ratio > 0.6) return 0.1;
  if (factorCategory === 'hour' && ratio > 0.55) return 0.08;
  return 0;
}
