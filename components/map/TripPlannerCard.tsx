import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable, Share, Linking, Platform } from 'react-native';
import AccessibleText from '@/components/ui/AccessibleText';
import { Bell, BellOff, CalendarPlus, Clock, MapPin, Share2 } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import type { HourlyBiteForecast, WeatherSnapshot } from '@/lib/api/endpoints/weather';
import { getActivityColor } from '@/utils/fishingEngine';
import {
  buildGoogleCalendarUrl,
  formatTripWindowRange,
  formatTripWindowSummary,
  getBestTripWindow,
} from '@/utils/tripPlanner';
import { formatReminderTime } from '@/utils/tripReminders';
import type { PersonalBiteFingerprint } from '@/lib/types/personalBite';
import { buildCatchConditions } from '@/utils/catchConditions';
import {
  computePersonalPatternMatch,
  getMatchingFactorLabels,
} from '@/utils/personalBiteFingerprint';
import { isPersonalBiteEnabled } from '@/constants/features';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/components/ui';
import { hapticLight } from '@/utils/haptics';
import { useTripReminder } from '@/hooks/useTripReminder';

interface TripPlannerCardProps {
  hourlyForecast: HourlyBiteForecast[];
  spotName?: string;
  latitude?: number;
  longitude?: number;
  referenceDate?: Date;
  onGoToSpot?: () => void;
  fingerprint?: PersonalBiteFingerprint;
  weather?: WeatherSnapshot | null;
}

export default function TripPlannerCard({
  hourlyForecast,
  spotName,
  latitude,
  longitude,
  referenceDate,
  onGoToSpot,
  fingerprint,
  weather,
}: TripPlannerCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();

  const tripWindow = useMemo(
    () => getBestTripWindow(hourlyForecast, referenceDate ?? new Date()),
    [hourlyForecast, referenceDate]
  );

  const patternMatch = useMemo(() => {
    if (!isPersonalBiteEnabled() || !fingerprint?.unlocked || !weather || !tripWindow) {
      return undefined;
    }
    const conditions = buildCatchConditions(weather);
    const score = computePersonalPatternMatch(fingerprint, {
      hour: tripWindow.startTime.getHours(),
      conditions,
    });
    const factors = getMatchingFactorLabels(fingerprint, {
      hour: tripWindow.startTime.getHours(),
      conditions,
    });
    return { score, factors, latitude, longitude };
  }, [fingerprint, weather, tripWindow, latitude, longitude]);

  const { isScheduled, reminderLabel, loading, schedule, cancel } = useTripReminder(
    tripWindow,
    spotName,
    patternMatch
  );

  if (!tripWindow) return null;

  const rangeLabel = formatTripWindowRange(tripWindow);
  const ratingColor = getActivityColor(tripWindow.peakRating);
  const referenceMs = (referenceDate ?? new Date()).getTime();
  const startsInMinutes = Math.max(
    0,
    Math.round((tripWindow.startTime.getTime() - referenceMs) / 60000)
  );
  const timingLabel =
    startsInMinutes <= 5
      ? referenceDate && referenceDate.getTime() > Date.now()
        ? 'Best window on this day'
        : 'Starting now'
      : startsInMinutes < 60
        ? `Starts in ${startsInMinutes} min`
        : `Starts in ${Math.round(startsInMinutes / 60)}h ${startsInMinutes % 60}m`;

  const handleAddToCalendar = async () => {
    hapticLight();
    const title = spotName ? `Fishing — ${spotName}` : 'Fishing trip';
    const details = formatTripWindowSummary(tripWindow, spotName);
    const url = buildGoogleCalendarUrl({
      title,
      startTime: tripWindow.startTime,
      endTime: tripWindow.endTime,
      details,
      latitude,
      longitude,
    });

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        showToast({ message: 'Could not open calendar on this device', variant: 'warning' });
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      if (__DEV__) console.warn('[tripPlanner] calendar open failed:', error);
      showToast({ message: 'Could not open calendar', variant: 'error' });
    }
  };

  const handleReminder = async () => {
    hapticLight();
    if (isScheduled) {
      await cancel();
      showToast({ message: 'Bite window reminder cancelled' });
      return;
    }

    const result = await schedule();
    if (result.ok) {
      showToast({
        message: `Reminder set for ${formatReminderTime(result.fireAt)}`,
        variant: 'success',
      });
      return;
    }

    const messages: Record<typeof result.reason, string> = {
      past: 'This bite window has already started',
      permission_denied: 'Enable notifications in Settings to get bite reminders',
      unavailable: 'Could not schedule reminder on this device',
      web: 'Reminders are available in the mobile app',
    };
    showToast({ message: messages[result.reason], variant: 'warning' });
  };

  const handleShare = async () => {
    hapticLight();
    const message = formatTripWindowSummary(tripWindow, spotName);
    try {
      await Share.share({
        message:
          latitude != null && longitude != null
            ? `${message}\nhttps://maps.google.com/?q=${latitude},${longitude}`
            : message,
      });
    } catch (error) {
      if (__DEV__) console.warn('[tripPlanner] share failed:', error);
      showToast({ message: 'Could not share trip plan', variant: 'error' });
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <CalendarPlus color={colors.accent} size={18} />
        <AccessibleText style={styles.title}>Plan your trip</AccessibleText>
      </View>

      <View style={styles.windowRow}>
        <Clock color={colors.textSecondary} size={16} />
        <View style={styles.windowText}>
          <AccessibleText style={styles.windowRange}>{rangeLabel}</AccessibleText>
          <AccessibleText style={styles.windowMeta}>
            <AccessibleText style={{ color: ratingColor, fontWeight: FontWeights.semibold }}>
              {tripWindow.peakLabel}
            </AccessibleText>
            {` · ${tripWindow.period} · ${timingLabel}`}
          </AccessibleText>
        </View>
      </View>

      {spotName ? (
        <View style={styles.spotRow}>
          <MapPin color={colors.textMuted} size={14} />
          <AccessibleText style={styles.spotName} numberOfLines={1}>
            {spotName}
          </AccessibleText>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
          onPress={handleAddToCalendar}
          accessibilityRole="button"
          accessibilityLabel={`Add fishing trip to calendar, ${rangeLabel}`}
        >
          <CalendarPlus color={colors.accentForeground} size={16} />
          <AccessibleText style={styles.actionPrimaryText}>Add to calendar</AccessibleText>
        </Pressable>

        {Platform.OS !== 'web' ? (
          <Pressable
            style={({ pressed }) => [
              styles.actionButtonSecondary,
              isScheduled && styles.actionButtonScheduled,
              pressed && styles.actionPressed,
            ]}
            onPress={handleReminder}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={
              isScheduled
                ? `Cancel bite window reminder at ${reminderLabel ?? 'scheduled time'}`
                : 'Remind me 30 minutes before the bite window'
            }
          >
            {isScheduled ? (
              <BellOff color={colors.accent} size={16} />
            ) : (
              <Bell color={colors.accent} size={16} />
            )}
            <AccessibleText style={styles.actionSecondaryText}>
              {isScheduled ? `Remind ${reminderLabel}` : 'Remind me'}
            </AccessibleText>
          </Pressable>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.actionButtonSecondary, pressed && styles.actionPressed]}
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel="Share trip plan"
        >
          <Share2 color={colors.accent} size={16} />
          <AccessibleText style={styles.actionSecondaryText}>Share</AccessibleText>
        </Pressable>
      </View>

      {onGoToSpot ? (
        <Pressable
          style={({ pressed }) => [styles.goLink, pressed && styles.actionPressed]}
          onPress={onGoToSpot}
          accessibilityRole="button"
          accessibilityLabel={`Go to ${spotName ?? 'spot'} on map`}
        >
          <AccessibleText style={styles.goLinkText}>View on map</AccessibleText>
        </Pressable>
      ) : null}

      {Platform.OS === 'web' ? (
        <AccessibleText style={styles.hint}>Calendar opens Google Calendar in a new tab on web.</AccessibleText>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    title: {
      fontSize: FontSizes.md,
      fontWeight: FontWeights.bold,
      color: colors.text,
    },
    windowRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    windowText: {
      flex: 1,
      gap: 2,
    },
    windowRange: {
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.bold,
      color: colors.text,
    },
    windowMeta: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
    },
    spotRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    spotName: {
      flex: 1,
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.accent,
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    actionButtonSecondary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    actionButtonScheduled: {
      borderColor: colors.accent,
    },
    actionPrimaryText: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      color: colors.accentForeground,
    },
    actionSecondaryText: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      color: colors.accent,
    },
    actionPressed: {
      opacity: 0.88,
    },
    goLink: {
      alignSelf: 'flex-start',
      paddingVertical: 4,
    },
    goLinkText: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      color: colors.accent,
    },
    hint: {
      fontSize: FontSizes.xs,
      color: colors.textMuted,
    },
  });
}
