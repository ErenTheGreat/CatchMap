import { useCallback, useEffect, useState } from 'react';
import type { TripWindow } from '@/utils/tripPlanner';
import {
  cancelStoredTripReminder,
  computeReminderFireTime,
  formatReminderTime,
  loadStoredTripReminder,
  reminderMatchesWindow,
  scheduleTripReminder,
} from '@/utils/tripReminders';

export interface TripReminderPatternMatch {
  score?: number;
  factors?: string[];
  latitude?: number;
  longitude?: number;
}

export function useTripReminder(
  tripWindow: TripWindow | null,
  spotName?: string,
  patternMatch?: TripReminderPatternMatch,
  speciesName?: string
) {
  const [reminderFireAt, setReminderFireAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadStoredTripReminder().then((stored) => {
      if (cancelled || !tripWindow) {
        if (!cancelled) setReminderFireAt(null);
        return;
      }
      if (reminderMatchesWindow(stored, tripWindow, spotName)) {
        const fireAt = computeReminderFireTime(tripWindow.startTime);
        setReminderFireAt(fireAt);
      } else {
        setReminderFireAt(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tripWindow, spotName]);

  const schedule = useCallback(async () => {
    if (!tripWindow) return { ok: false as const, reason: 'past' as const };
    setLoading(true);
    try {
      const result = await scheduleTripReminder({
        tripWindow,
        spotName,
        speciesName,
        patternMatchScore: patternMatch?.score,
        patternMatchFactors: patternMatch?.factors,
        latitude: patternMatch?.latitude,
        longitude: patternMatch?.longitude,
      });
      if (result.ok) {
        setReminderFireAt(result.fireAt);
      }
      return result;
    } finally {
      setLoading(false);
    }
  }, [tripWindow, spotName, speciesName, patternMatch?.score, patternMatch?.factors, patternMatch?.latitude, patternMatch?.longitude]);

  const cancel = useCallback(async () => {
    setLoading(true);
    try {
      await cancelStoredTripReminder();
      setReminderFireAt(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const isScheduled = reminderFireAt != null;

  return {
    isScheduled,
    reminderFireAt,
    reminderLabel: reminderFireAt ? formatReminderTime(reminderFireAt) : null,
    loading,
    schedule,
    cancel,
  };
}
