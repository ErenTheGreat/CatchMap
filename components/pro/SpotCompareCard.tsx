import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import ProUpsellCard from '@/components/pro/ProUpsellCard';
import { isProSpotCompareEnabled } from '@/constants/features';
import { formatDistance } from '@/utils/recommendations';
import { getActivityColor } from '@/utils/fishingEngine';
import { getBestTripWindow, formatTripWindowRange } from '@/utils/tripPlanner';
import type { RankedDiscoverySpot } from '@/utils/spotDiscoveryScore';
import type { NearbySpot } from '@/utils/recommendations';

interface SpotCompareCardProps {
  compareSpots: RankedDiscoverySpot[];
  onSpotPress: (spot: NearbySpot) => void;
}

export default function SpotCompareCard({ compareSpots, onSpotPress }: SpotCompareCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const rows = useMemo(
    () =>
      compareSpots.map((item) => {
        const window = getBestTripWindow(item.score.hourlyForecast ?? []);
        return {
          item,
          windowRange: window ? formatTripWindowRange(window) : null,
        };
      }),
    [compareSpots]
  );

  if (compareSpots.length < 2) return null;

  if (!isProSpotCompareEnabled()) {
    return (
      <ProUpsellCard
        compact
        title="Pro spot compare"
        description="Compare close spots side-by-side — species, bite windows, and scores."
      />
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Close contenders</Text>
      {rows.map(({ item, windowRange }) => (
        <TouchableOpacity
          key={item.spot.id}
          style={styles.row}
          onPress={() => onSpotPress(item.spot)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`${item.spot.name}, ${item.score.label} bite`}
        >
          <View style={styles.rowHeader}>
            <Text style={styles.name} numberOfLines={1}>
              {item.spot.name}
            </Text>
            <Text style={[styles.rating, { color: getActivityColor(item.score.activityRating) }]}>
              {item.score.activityRating}/5 · {item.score.label}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <MapPin color={colors.textSecondary} size={12} />
            <Text style={styles.meta}>{formatDistance(item.spot.distance)}</Text>
            {item.score.topSpeciesHint ? (
              <Text style={styles.meta}>
                Likely {item.score.topSpeciesHint}
                {item.score.topSpeciesProbability != null
                  ? ` ${item.score.topSpeciesProbability}%`
                  : ''}
              </Text>
            ) : null}
          </View>
          {windowRange ? (
            <Text style={styles.window}>Best window: {windowRange}</Text>
          ) : null}
        </TouchableOpacity>
      ))}
    </View>
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
    title: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      color: colors.text,
    },
    row: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: Spacing.sm,
      gap: 4,
    },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    name: {
      flex: 1,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      color: colors.text,
    },
    rating: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    meta: {
      fontSize: FontSizes.xs,
      color: colors.textSecondary,
    },
    window: {
      fontSize: FontSizes.xs,
      color: colors.text,
      fontWeight: FontWeights.medium,
    },
  });
}
