import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useSavedSpots } from '@/providers/SavedSpotsProvider';
import { fishingApi } from '@/lib/api/fishingApi';
import { isBiteStormEnabled } from '@/constants/features';
import {
  buildSpotBiteSnapshot,
  detectBiteStorm,
  formatBiteStormNotificationBody,
  formatBiteStormNotificationTitle,
  pickBestBiteStorm,
  type BiteStormSnapshot,
} from '@/utils/biteStorm';
import {
  ensureNotificationPermissions,
  isNotificationsAvailable,
} from '@/utils/tripReminders';

const BITE_STORM_SNAPSHOTS_KEY = '@bite_storm_snapshots_v1';
const BITE_STORM_ALERT_KEY = '@bite_storm_last_alert_v1';
const CHECK_INTERVAL_MS = 2 * 60 * 60 * 1000;
const ALERT_COOLDOWN_MS = 4 * 60 * 60 * 1000;

async function loadSnapshots(): Promise<Record<string, BiteStormSnapshot>> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const raw = await AsyncStorage.getItem(BITE_STORM_SNAPSHOTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, BiteStormSnapshot>;
  } catch (error) {
    if (__DEV__) console.warn('[biteStorm] load snapshots failed:', error);
    return {};
  }
}

async function persistSnapshots(snapshots: Record<string, BiteStormSnapshot>): Promise<void> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(BITE_STORM_SNAPSHOTS_KEY, JSON.stringify(snapshots));
  } catch (error) {
    if (__DEV__) console.warn('[biteStorm] persist snapshots failed:', error);
  }
}

async function loadLastAlertAt(): Promise<number> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const raw = await AsyncStorage.getItem(BITE_STORM_ALERT_KEY);
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

async function persistLastAlertAt(timestamp: number): Promise<void> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(BITE_STORM_ALERT_KEY, String(timestamp));
  } catch (error) {
    if (__DEV__) console.warn('[biteStorm] persist last alert failed:', error);
  }
}

async function scheduleBiteStormNotification(title: string, body: string): Promise<void> {
  if (!isNotificationsAvailable()) return;

  try {
    const permitted = await ensureNotificationPermissions();
    if (!permitted) return;

    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
      },
    });
  } catch (error) {
    if (__DEV__) console.warn('[biteStorm] schedule notification failed:', error);
  }
}

/**
 * Proactively checks saved spots for sudden bite-condition spikes and sends
 * at most one Bite Storm alert per cooldown window.
 */
export function useBiteStormAlerts(enabled = true) {
  const { savedSpots } = useSavedSpots();
  const checkingRef = useRef(false);
  const lastCheckRef = useRef(0);

  useEffect(() => {
    if (!enabled || !isBiteStormEnabled() || Platform.OS === 'web') return;
    if (savedSpots.length === 0) return;

    let cancelled = false;

    void (async () => {
      if (checkingRef.current) return;
      const now = Date.now();
      if (now - lastCheckRef.current < CHECK_INTERVAL_MS) return;

      checkingRef.current = true;
      lastCheckRef.current = now;

      try {
        const previousSnapshots = await loadSnapshots();
        const hasBaseline = Object.keys(previousSnapshots).length > 0;
        const controller = new AbortController();
        const nextSnapshots: Record<string, BiteStormSnapshot> = { ...previousSnapshots };
        const alerts = [];

        for (const spot of savedSpots.slice(0, 5)) {
          try {
            const weather = await fishingApi.getWeather(
              spot.latitude,
              spot.longitude,
              controller.signal
            );
            const current = buildSpotBiteSnapshot(spot, weather);
            if (!current) continue;

            if (hasBaseline) {
              const storm = detectBiteStorm(
                spot,
                previousSnapshots[spot.id],
                current,
                weather
              );
              if (storm) alerts.push(storm);
            }

            nextSnapshots[spot.id] = current;
          } catch (error) {
            if (__DEV__) console.warn('[biteStorm] weather fetch failed:', spot.id, error);
          }
        }

        if (cancelled) return;

        await persistSnapshots(nextSnapshots);

        if (!hasBaseline || alerts.length === 0) return;

        const lastAlertAt = await loadLastAlertAt();
        if (Date.now() - lastAlertAt < ALERT_COOLDOWN_MS) return;

        const best = pickBestBiteStorm(alerts);
        if (!best) return;

        await scheduleBiteStormNotification(
          formatBiteStormNotificationTitle(best),
          formatBiteStormNotificationBody(best)
        );
        await persistLastAlertAt(Date.now());
      } finally {
        checkingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, savedSpots]);
}
