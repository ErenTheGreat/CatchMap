import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useSavedSpots } from '@/providers/SavedSpotsProvider';
import { usePersonalBiteFingerprint } from '@/hooks/usePersonalBiteFingerprint';
import { fishingApi } from '@/lib/api/fishingApi';
import { isPersonalBiteEnabled } from '@/constants/features';
import {
  evaluateSavedSpotPatternMatch,
  formatPatternMatchNotificationBody,
  formatPatternMatchNotificationTitle,
  pickBestPatternMatch,
} from '@/utils/patternMatchAlerts';
import {
  ensureNotificationPermissions,
  isNotificationsAvailable,
  loadStoredTripReminder,
} from '@/utils/tripReminders';

const PATTERN_ALERT_STORAGE_KEY = '@pattern_match_alert_v1';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function loadLastPatternAlertCheck(): Promise<number> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const raw = await AsyncStorage.getItem(PATTERN_ALERT_STORAGE_KEY);
    return raw ? Number(raw) : 0;
  } catch (error) {
    if (__DEV__) console.warn('[patternAlerts] load last check failed:', error);
    return 0;
  }
}

async function persistLastPatternAlertCheck(timestamp: number): Promise<void> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(PATTERN_ALERT_STORAGE_KEY, String(timestamp));
  } catch (error) {
    if (__DEV__) console.warn('[patternAlerts] persist last check failed:', error);
  }
}

async function schedulePatternMatchNotification(
  spotName: string,
  body: string
): Promise<void> {
  if (!isNotificationsAvailable()) return;

  try {
    const permitted = await ensureNotificationPermissions();
    if (!permitted) return;

    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: {
        title: formatPatternMatchNotificationTitle(spotName),
        body,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
      },
    });
  } catch (error) {
    if (__DEV__) console.warn('[patternAlerts] schedule notification failed:', error);
  }
}

/**
 * Proactively checks saved spots for personal pattern matches and sends
 * at most one alert per check cycle (avoids spamming).
 */
export function usePatternMatchAlerts(enabled = true) {
  const { savedSpots } = useSavedSpots();
  const { fingerprint } = usePersonalBiteFingerprint();
  const checkingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isPersonalBiteEnabled() || Platform.OS === 'web') return;
    if (!fingerprint.unlocked || savedSpots.length === 0) return;

    let cancelled = false;

    void (async () => {
      if (checkingRef.current) return;
      checkingRef.current = true;

      try {
        const lastCheck = await loadLastPatternAlertCheck();
        if (Date.now() - lastCheck < CHECK_INTERVAL_MS) return;

        const existingReminder = await loadStoredTripReminder();
        if (existingReminder?.patternMatchScore != null) return;

        const controller = new AbortController();
        const matches = await Promise.all(
          savedSpots.slice(0, 5).map(async (spot) => {
            try {
              const weather = await fishingApi.getWeather(
                spot.latitude,
                spot.longitude,
                controller.signal
              );
              return evaluateSavedSpotPatternMatch(spot, fingerprint, weather);
            } catch (error) {
              if (__DEV__) console.warn('[patternAlerts] weather fetch failed for spot:', spot.id, error);
              return null;
            }
          })
        );

        if (cancelled) return;

        const best = pickBestPatternMatch(
          matches.filter((m): m is NonNullable<typeof m> => m != null)
        );

        if (best) {
          await schedulePatternMatchNotification(
            best.spotName,
            formatPatternMatchNotificationBody(best)
          );
        }

        await persistLastPatternAlertCheck(Date.now());
      } finally {
        checkingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, fingerprint.unlocked, savedSpots, fingerprint]);
}
