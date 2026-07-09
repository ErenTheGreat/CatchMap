import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TripWindow } from '@/utils/tripPlanner';
import { formatTripWindowRange, formatTripWindowSummary } from '@/utils/tripPlanner';

const REMINDER_STORAGE_KEY = '@trip_reminder_v1';
export const DEFAULT_REMINDER_LEAD_MINUTES = 30;

export interface StoredTripReminder {
  notificationId: string;
  windowStartIso: string;
  spotKey: string;
  /** Personal pattern match score 0–100 when scheduled. */
  patternMatchScore?: number;
  /** Top matching factor labels at schedule time. */
  patternMatchFactors?: string[];
  /** Trip window end — used for post-trip feedback prompt. */
  windowEndIso?: string;
  spotName?: string;
  latitude?: number;
  longitude?: number;
}

export interface ScheduleTripReminderOptions {
  tripWindow: TripWindow;
  spotName?: string;
  leadMinutes?: number;
  patternMatchScore?: number;
  patternMatchFactors?: string[];
  latitude?: number;
  longitude?: number;
}

export type ScheduleTripReminderResult =
  | { ok: true; fireAt: Date; notificationId: string }
  | { ok: false; reason: 'past' | 'permission_denied' | 'unavailable' | 'web' };

export function buildTripReminderSpotKey(spotName?: string): string {
  return spotName?.trim() || 'map-area';
}

export function computeReminderFireTime(
  windowStart: Date,
  now: Date = new Date(),
  leadMinutes = DEFAULT_REMINDER_LEAD_MINUTES
): Date | null {
  if (windowStart.getTime() <= now.getTime()) return null;

  const leadMs = leadMinutes * 60 * 1000;
  let fireAt = new Date(windowStart.getTime() - leadMs);

  if (fireAt.getTime() <= now.getTime()) {
    const fiveMinBefore = new Date(windowStart.getTime() - 5 * 60 * 1000);
    fireAt =
      fiveMinBefore.getTime() > now.getTime()
        ? fiveMinBefore
        : new Date(now.getTime() + 60 * 1000);
  }

  if (fireAt.getTime() >= windowStart.getTime()) return null;
  return fireAt;
}

export async function loadStoredTripReminder(): Promise<StoredTripReminder | null> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredTripReminder;
  } catch (error) {
    if (__DEV__) console.warn('[tripReminders] corrupt stored reminder:', error);
    return null;
  }
}

async function persistStoredTripReminder(reminder: StoredTripReminder | null): Promise<void> {
  if (!reminder) {
    await AsyncStorage.removeItem(REMINDER_STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminder));
}

function isNotificationsAvailable(): boolean {
  try {
    const { NativeModules, Platform } = require('react-native') as typeof import('react-native');
    if (Platform.OS === 'web') return false;
    return Boolean(
      (NativeModules as { ExpoNotifications?: unknown }).ExpoNotifications
    );
  } catch {
    return false;
  }
}

async function getNotificationsModule() {
  return import('expo-notifications') as Promise<typeof import('expo-notifications')>;
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (!isNotificationsAvailable()) return false;
  const Notifications = await getNotificationsModule();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted ?? false;
}

export async function cancelStoredTripReminder(): Promise<void> {
  const stored = await loadStoredTripReminder();
  if (!stored) return;

  if (isNotificationsAvailable()) {
    try {
      const Notifications = await getNotificationsModule();
      await Notifications.cancelScheduledNotificationAsync(stored.notificationId);
    } catch (error) {
      if (__DEV__) console.warn('[tripReminders] cancel notification failed:', error);
      // Notification may already have fired.
    }
  }

  await persistStoredTripReminder(null);
}

export function reminderMatchesWindow(
  stored: StoredTripReminder | null,
  tripWindow: TripWindow,
  spotName?: string
): boolean {
  if (!stored) return false;
  return (
    stored.windowStartIso === tripWindow.startTime.toISOString() &&
    stored.spotKey === buildTripReminderSpotKey(spotName)
  );
}

export async function scheduleTripReminder(
  options: ScheduleTripReminderOptions
): Promise<ScheduleTripReminderResult> {
  const {
    tripWindow,
    spotName,
    leadMinutes = DEFAULT_REMINDER_LEAD_MINUTES,
    patternMatchScore,
    patternMatchFactors,
    latitude,
    longitude,
  } = options;

  const fireAt = computeReminderFireTime(tripWindow.startTime, new Date(), leadMinutes);
  if (!fireAt) {
    return { ok: false, reason: 'past' };
  }

  if (!isNotificationsAvailable()) {
    return { ok: false, reason: 'web' };
  }

  const permitted = await ensureNotificationPermissions();
  if (!permitted) {
    return { ok: false, reason: 'permission_denied' };
  }

  await cancelStoredTripReminder();

  const Notifications = await getNotificationsModule();

  const title =
    patternMatchScore != null && patternMatchScore >= 70 && spotName
      ? `Pattern match (${patternMatchScore}%) — ${spotName}`
      : spotName
        ? `Fishing soon — ${spotName}`
        : 'Fishing bite window soon';

  let body = `${formatTripWindowSummary(tripWindow, spotName)}. Window: ${formatTripWindowRange(tripWindow)}.`;
  if (patternMatchScore != null && patternMatchScore >= 70) {
    const factors =
      patternMatchFactors && patternMatchFactors.length > 0
        ? ` Matches your pattern: ${patternMatchFactors.join(', ')}.`
        : ' Conditions match your personal bite fingerprint.';
    body = `${patternMatchScore}% match to your best days.${factors} ${body}`;
  }

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    });

    await persistStoredTripReminder({
      notificationId,
      windowStartIso: tripWindow.startTime.toISOString(),
      windowEndIso: tripWindow.endTime.toISOString(),
      spotKey: buildTripReminderSpotKey(spotName),
      patternMatchScore,
      patternMatchFactors,
      spotName,
      latitude,
      longitude,
    });

    return { ok: true, fireAt, notificationId };
  } catch (error) {
    if (__DEV__) console.warn('[tripReminders] schedule failed:', error);
    return { ok: false, reason: 'unavailable' };
  }
}

export function formatReminderTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
