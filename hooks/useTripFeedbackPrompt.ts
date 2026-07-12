import { useCallback, useEffect, useState } from 'react';
import {
  clearPendingTripFeedbackPrompt,
  loadPendingTripFeedbackPrompt,
  loadTripFeedbackRecords,
  queueTripFeedbackIfDue,
  saveTripFeedback,
  computeTripFeedbackStats,
  type PendingTripFeedbackPrompt,
  type TripFeedbackStats,
  type TripOutcomeRating,
} from '@/utils/tripFeedback';
import { loadStoredTripReminder } from '@/utils/tripReminders';

export function useTripFeedbackPrompt() {
  const [pending, setPending] = useState<PendingTripFeedbackPrompt | null>(null);
  const [stats, setStats] = useState<TripFeedbackStats>({
    totalRated: 0,
    accurateCount: 0,
    accuracyPct: 0,
  });

  const refresh = useCallback(async () => {
    const storedReminder = await loadStoredTripReminder();
    if (storedReminder?.windowEndIso) {
      await queueTripFeedbackIfDue(
        storedReminder.windowEndIso,
        storedReminder.spotKey,
        storedReminder.spotName,
        storedReminder.windowStartIso,
        storedReminder.patternMatchScore != null
          ? Math.round(storedReminder.patternMatchScore / 20)
          : undefined
      );
    }

    const prompt = await loadPendingTripFeedbackPrompt();
    setPending(prompt);

    const records = await loadTripFeedbackRecords();
    setStats(computeTripFeedbackStats(records));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submitRating = useCallback(
    async (outcome: TripOutcomeRating) => {
      if (!pending) return;
      await saveTripFeedback({
        id: `${pending.spotKey}-${pending.windowStartIso}`,
        spotKey: pending.spotKey,
        spotName: pending.spotName,
        windowStartIso: pending.windowStartIso,
        windowEndIso: pending.windowEndIso,
        predictedRating: pending.predictedRating,
        outcome,
        ratedAt: Date.now(),
      });
      setPending(null);
      const records = await loadTripFeedbackRecords();
      setStats(computeTripFeedbackStats(records));
    },
    [pending]
  );

  const dismiss = useCallback(async () => {
    await clearPendingTripFeedbackPrompt();
    setPending(null);
  }, []);

  return {
    pending,
    stats,
    submitRating,
    dismiss,
    refresh,
  };
}
