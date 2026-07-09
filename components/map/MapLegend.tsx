import React from 'react';
import { View, StyleSheet } from 'react-native';
import AccessibleText from '@/components/ui/AccessibleText';
import { Spacing, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import {
  ACTIVITY_PIN_LEGEND,
  getActivityPinColors,
  type ActivityPinColors,
} from '@/components/map/clusterLayerStyles';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';

interface MapLegendProps {
  visible?: boolean;
  /** Position the legend below the floating map header (search bar). */
  topOffset?: number;
}

/** Approximate rendered height for stacking banners below the legend. */
export const MAP_LEGEND_ESTIMATED_HEIGHT = 58;

function legendColorForRating(
  rating: (typeof ACTIVITY_PIN_LEGEND)[number]['rating'],
  pinColors: ActivityPinColors
): string {
  switch (rating) {
    case 1:
      return pinColors.slow;
    case 2:
      return pinColors.fair;
    case 3:
      return pinColors.good;
    case 4:
      return pinColors.hot;
    case 5:
      return pinColors.excellent;
    default:
      return pinColors.slow;
  }
}

export function MapLegend({ visible = true, topOffset = 0 }: MapLegendProps) {
  const { isDark, isOutdoor } = useTheme();
  const styles = useThemedStyles(createStyles);
  const pinColors = getActivityPinColors(isDark, isOutdoor);

  if (!visible || topOffset <= 0) return null;

  return (
    <View style={[styles.legend, { top: topOffset }]} pointerEvents="none">
      <AccessibleText style={styles.legendCaption}>Pin colors = bite activity (not a heat map)</AccessibleText>
      <View style={styles.legendRow}>
        {ACTIVITY_PIN_LEGEND.map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: legendColorForRating(item.rating, pinColors) },
              ]}
            />
            <AccessibleText style={styles.legendText}>{item.label}</AccessibleText>
          </View>
        ))}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    legend: {
      position: 'absolute',
      left: Spacing.sm,
      right: Spacing.sm,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.md,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 3,
      zIndex: 8,
      gap: 2,
    },
    legendCaption: {
      fontSize: 10,
      color: colors.textSecondary,
      fontWeight: FontWeights.medium,
    },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 11,
      color: colors.text,
      fontWeight: FontWeights.medium,
    },
  });
}

export function getMapContainerStyle(colors: ThemeColors) {
  return {
    flex: 1 as const,
    width: '100%' as const,
    overflow: 'hidden' as const,
    backgroundColor: colors.cardLight,
  };
}
