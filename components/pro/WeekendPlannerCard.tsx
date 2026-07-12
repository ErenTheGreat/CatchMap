import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Calendar, MapPin } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import ProUpsellCard from '@/components/pro/ProUpsellCard';
import { isWeekendPlannerEnabled } from '@/constants/features';
import { fishingApi } from '@/lib/api/fishingApi';
import type { SavedSpotSnapshot } from '@/lib/types/savedSpot';
import { rankWeekendOutlooks, type WeekendPick } from '@/utils/weekendPlanner';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import { getActivityColor } from '@/utils/fishingEngine';
import { savedSpotToNearbySpot } from '@/lib/types/savedSpot';
import type { NearbySpot } from '@/utils/recommendations';

interface WeekendPlannerCardProps {
  savedSpots: SavedSpotSnapshot[];
  onSpotPress?: (spot: NearbySpot) => void;
}

export default function WeekendPlannerCard({
  savedSpots,
  onSpotPress,
}: WeekendPlannerCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [weatherBySpotId, setWeatherBySpotId] = useState<Record<string, WeatherSnapshot | null>>(
    {}
  );
  const [loading, setLoading] = useState(false);

  const spotKey = useMemo(
    () =>
      savedSpots
        .slice(0, 5)
        .map((s) => s.id)
        .join(','),
    [savedSpots]
  );

  useEffect(() => {
    if (!isWeekendPlannerEnabled() || savedSpots.length === 0) return;

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

  const picks = useMemo(
    () => rankWeekendOutlooks(savedSpots, weatherBySpotId),
    [savedSpots, weatherBySpotId]
  );

  if (!isWeekendPlannerEnabled()) {
    return (
      <ProUpsellCard
        compact
        title="Weekend planner"
        description="See the best Saturday and Sunday bite windows across your saved spots."
      />
    );
  }

  if (savedSpots.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Calendar color={colors.accent} size={18} />
        <Text style={styles.title}>Weekend planner</Text>
        {loading ? <ActivityIndicator color={colors.accent} size="small" /> : null}
      </View>
      <Text style={styles.hint}>Best Sat/Sun windows across your saved spots.</Text>
      {loading && picks.length === 0 ? (
        <Text style={styles.loadingText}>Checking weekend outlook…</Text>
      ) : null}
      {!loading && picks.length === 0 ? (
        <Text style={styles.emptyText}>Save spots on the map to see weekend picks.</Text>
      ) : null}
      {picks.map((pick) => (
        <WeekendPickRow
          key={`${pick.spotId}-${pick.dayLabel}`}
          pick={pick}
          styles={styles}
          colors={colors}
          onPress={() => onSpotPress?.(savedSpotToNearbySpot(
            savedSpots.find((s) => s.id === pick.spotId) ?? {
              id: pick.spotId,
              name: pick.spotName,
              latitude: pick.latitude,
              longitude: pick.longitude,
              water_type: 'lake',
              savedAt: Date.now(),
            }
          ))}
        />
      ))}
    </View>
  );
}

function WeekendPickRow({
  pick,
  styles,
  colors,
  onPress,
}: {
  pick: WeekendPick;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button">
      <View style={styles.rowHeader}>
        <Text style={styles.dayLabel}>{pick.dayLabel}</Text>
        <Text style={[styles.peak, { color: getActivityColor(pick.peakRating) }]}>
          {pick.peakRating}/5 · {pick.peakLabel}
        </Text>
      </View>
      <View style={styles.spotRow}>
        <MapPin color={colors.accent} size={14} />
        <Text style={styles.spotName} numberOfLines={1}>
          {pick.spotName}
        </Text>
      </View>
      {pick.windowRange ? (
        <Text style={styles.window}>Best window: {pick.windowRange}</Text>
      ) : null}
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
    dayLabel: {
      fontSize: FontSizes.sm,
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
    },
    window: {
      fontSize: FontSizes.xs,
      color: colors.textSecondary,
      marginLeft: 20,
    },
  });
}
