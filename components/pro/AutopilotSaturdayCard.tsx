import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Bell, Calendar, MapPin, Route } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { Button, useToast } from '@/components/ui';
import ProUpsellCard from '@/components/pro/ProUpsellCard';
import { isAutopilotSaturdayEnabled } from '@/constants/features';
import { fishingApi } from '@/lib/api/fishingApi';
import type { SavedSpotSnapshot } from '@/lib/types/savedSpot';
import { savedSpotToNearbySpot } from '@/lib/types/savedSpot';
import {
  buildAutopilotSaturday,
  buildSaturdayCandidates,
  type AutopilotLeg,
} from '@/utils/autopilotSaturday';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import { getActivityColor } from '@/utils/fishingEngine';
import {
  cancelAutopilotReminders,
  formatReminderTime,
  loadAutopilotReminders,
  scheduleAutopilotReminders,
} from '@/utils/tripReminders';
import { hapticLight } from '@/utils/haptics';
import type { NearbySpot } from '@/utils/recommendations';

interface AutopilotSaturdayCardProps {
  savedSpots: SavedSpotSnapshot[];
  onSpotPress?: (spot: NearbySpot) => void;
}

export default function AutopilotSaturdayCard({
  savedSpots,
  onSpotPress,
}: AutopilotSaturdayCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const [weatherBySpotId, setWeatherBySpotId] = useState<Record<string, WeatherSnapshot | null>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [remindersScheduled, setRemindersScheduled] = useState(false);
  const [schedulingReminders, setSchedulingReminders] = useState(false);

  const spotKey = useMemo(
    () =>
      savedSpots
        .slice(0, 5)
        .map((s) => s.id)
        .join(','),
    [savedSpots]
  );

  useEffect(() => {
    if (!isAutopilotSaturdayEnabled() || savedSpots.length === 0) return;

    const controller = new AbortController();
    setLoading(true);

    void Promise.all(
      savedSpots.slice(0, 5).map(async (spot) => {
        try {
          const weather = await fishingApi.getWeather(
            spot.latitude,
            spot.longitude,
            controller.signal
          );
          return [spot.id, weather] as const;
        } catch {
          return [spot.id, null] as const;
        }
      })
    )
      .then((entries) => {
        if (controller.signal.aborted) return;
        const map: Record<string, WeatherSnapshot | null> = {};
        for (const [id, weather] of entries) {
          map[id] = weather;
        }
        setWeatherBySpotId(map);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [spotKey, savedSpots]);

  useEffect(() => {
    void loadAutopilotReminders().then((stored) => {
      setRemindersScheduled(stored.length > 0);
    });
  }, []);

  const plan = useMemo(() => {
    const candidates = buildSaturdayCandidates(savedSpots, weatherBySpotId);
    return buildAutopilotSaturday(candidates);
  }, [savedSpots, weatherBySpotId]);

  const handleScheduleReminders = useCallback(async () => {
    if (!plan || plan.legs.length === 0) return;
    hapticLight();
    setSchedulingReminders(true);

    try {
      if (remindersScheduled) {
        await cancelAutopilotReminders();
        setRemindersScheduled(false);
        showToast({ message: 'Autopilot Saturday reminders cancelled' });
        return;
      }

      const result = await scheduleAutopilotReminders(
        plan.legs.map((leg) => ({
          legIndex: leg.legIndex,
          tripWindow: leg.window,
          spotName: leg.spotName,
          speciesName: leg.speciesHint,
          latitude: leg.latitude,
          longitude: leg.longitude,
        }))
      );

      if (result.ok) {
        setRemindersScheduled(true);
        const first = result.scheduled[0];
        showToast({
          message: `Reminders set for ${result.scheduled.length} stops${first ? ` — first at ${formatReminderTime(first.fireAt)}` : ''}`,
          variant: 'success',
        });
        return;
      }

      const messages: Record<typeof result.reason, string> = {
        permission_denied: 'Enable notifications in Settings to get trip reminders',
        unavailable: 'Could not schedule reminders on this device',
        web: 'Reminders are available in the mobile app',
        none_scheduled: 'No upcoming windows to remind you about',
      };
      showToast({ message: messages[result.reason], variant: 'warning' });
    } finally {
      setSchedulingReminders(false);
    }
  }, [plan, remindersScheduled, showToast]);

  if (!isAutopilotSaturdayEnabled()) {
    return (
      <ProUpsellCard
        compact
        title="Autopilot Saturday"
        description="One tap drafts a 3-stop Saturday rotation across your saved lakes with reminders."
      />
    );
  }

  if (savedSpots.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Route color={colors.accent} size={18} />
        <Text style={styles.title}>Autopilot Saturday</Text>
        {loading ? <ActivityIndicator color={colors.accent} size="small" /> : null}
      </View>
      <Text style={styles.hint}>
        Full-day 3-stop rotation with bite windows and drive gaps across your saved spots.
      </Text>

      {loading && !plan ? (
        <Text style={styles.loadingText}>Building your Saturday plan…</Text>
      ) : null}

      {!loading && !plan ? (
        <Text style={styles.emptyText}>
          No strong Saturday windows found yet — check back as the forecast updates.
        </Text>
      ) : null}

      {plan?.legs.map((leg) => (
        <AutopilotLegRow
          key={`${leg.spotId}-${leg.legIndex}`}
          leg={leg}
          styles={styles}
          colors={colors}
          onPress={() => {
            const spot = savedSpots.find((s) => s.id === leg.spotId);
            if (spot) onSpotPress?.(savedSpotToNearbySpot(spot));
          }}
        />
      ))}

      {plan && plan.legs.length > 0 ? (
        <Button
          title={remindersScheduled ? 'Cancel Saturday reminders' : 'Set all reminders'}
          onPress={() => void handleScheduleReminders()}
          loading={schedulingReminders}
          variant={remindersScheduled ? 'secondary' : 'primary'}
          icon={<Bell color={remindersScheduled ? colors.accent : colors.accentForeground} size={18} />}
          style={styles.reminderButton}
        />
      ) : null}
    </View>
  );
}

function AutopilotLegRow({
  leg,
  styles,
  colors,
  onPress,
}: {
  leg: AutopilotLeg;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button">
      <View style={styles.rowHeader}>
        <View style={styles.legBadge}>
          <Text style={styles.legBadgeText}>Stop {leg.legIndex}</Text>
        </View>
        <Text style={[styles.peak, { color: getActivityColor(leg.peakRating) }]}>
          {leg.peakRating}/5 · {leg.peakLabel}
        </Text>
      </View>
      <View style={styles.spotRow}>
        <MapPin color={colors.accent} size={14} />
        <Text style={styles.spotName} numberOfLines={1}>
          {leg.spotName}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Calendar color={colors.textSecondary} size={12} />
        <Text style={styles.meta}>{leg.windowRange}</Text>
        {leg.speciesHint ? <Text style={styles.meta}>Target {leg.speciesHint}</Text> : null}
      </View>
      {leg.travelNote ? <Text style={styles.travelNote}>{leg.travelNote}</Text> : null}
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: Spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    title: {
      flex: 1,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      color: colors.text,
    },
    hint: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    loadingText: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
    },
    emptyText: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
    },
    row: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: Spacing.sm,
      gap: 4,
    },
    rowHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    legBadge: {
      backgroundColor: colors.accentDark,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
    },
    legBadgeText: {
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.bold,
      color: colors.accent,
    },
    peak: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    spotRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    spotName: {
      flex: 1,
      fontSize: FontSizes.sm,
      color: colors.text,
      fontWeight: FontWeights.medium,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      flexWrap: 'wrap',
      marginLeft: 20,
    },
    meta: {
      fontSize: FontSizes.xs,
      color: colors.textSecondary,
    },
    travelNote: {
      fontSize: FontSizes.xs,
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginLeft: 20,
    },
    reminderButton: {
      marginTop: Spacing.xs,
    },
  });
}
