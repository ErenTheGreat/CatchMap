import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import AccessibleText from '@/components/ui/AccessibleText';
import { Clock, Fish, Sparkles, TrendingUp } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import type { CatchInsights } from '@/lib/types/catchInsights';
import { MIN_CATCHES_FOR_INSIGHTS } from '@/utils/catchInsights';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';

interface PersonalInsightsCardProps {
  insights: CatchInsights;
  onViewAll?: () => void;
}

export default function PersonalInsightsCard({ insights, onViewAll }: PersonalInsightsCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (!insights.hasEnoughData) {
    const logged = insights.totalCatches;
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Sparkles color={colors.textMuted} size={18} />
          <AccessibleText style={styles.title}>Personal insights</AccessibleText>
        </View>
        <AccessibleText style={styles.unlockText}>
          Log {insights.catchesUntilUnlock} more{' '}
          {insights.catchesUntilUnlock === 1 ? 'catch' : 'catches'} to unlock your best hours,
          seasons, and go-to spots.
        </AccessibleText>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, (logged / MIN_CATCHES_FOR_INSIGHTS) * 100)}%` },
            ]}
          />
        </View>
        <AccessibleText style={styles.progressLabel}>
          {logged} of {MIN_CATCHES_FOR_INSIGHTS} catches
        </AccessibleText>
      </View>
    );
  }

  const topHour = insights.bestHours[0];
  const topSpecies = insights.topSpecies[0];
  const topMonth = insights.bestMonths[0];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <TrendingUp color={colors.accent} size={18} />
        <AccessibleText style={styles.title}>Your patterns</AccessibleText>
        {onViewAll ? (
          <Pressable onPress={onViewAll} accessibilityRole="button" accessibilityLabel="View all patterns in History">
            <AccessibleText style={styles.viewAll}>View all</AccessibleText>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.statRow}>
        {topHour ? (
          <View style={styles.statChip}>
            <Clock color={colors.accent} size={12} />
            <AccessibleText style={styles.statText}>
              Best hour: {topHour.label}
            </AccessibleText>
          </View>
        ) : null}
        {topMonth ? (
          <View style={styles.statChip}>
            <AccessibleText style={styles.statText}>
              Top month: {topMonth.label}
            </AccessibleText>
          </View>
        ) : null}
      </View>

      {topSpecies ? (
        <View style={styles.speciesRow}>
          <Fish color={colors.success} size={14} />
          <AccessibleText style={styles.speciesText}>
            Most caught: {topSpecies.species} ({topSpecies.count})
          </AccessibleText>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: Spacing.sm,
    },
    headerRow: {
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
    viewAll: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
      color: colors.accent,
    },
    unlockText: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    progressTrack: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: BorderRadius.full,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.accent,
      borderRadius: BorderRadius.full,
    },
    progressLabel: {
      fontSize: FontSizes.xs,
      color: colors.textMuted,
    },
    statRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    statChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.accentDark,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.full,
    },
    statText: {
      fontSize: FontSizes.xs,
      color: colors.accent,
      fontWeight: FontWeights.medium,
    },
    speciesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    speciesText: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
    },
  });
}
