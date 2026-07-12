import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Fish, Users } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { Skeleton, ErrorState, ThemedText } from '@/components/ui';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import type { CommunityCatchSummary } from '@/utils/communityCatchIntel';

interface CommunityCatchIntelCardProps {
  summary: CommunityCatchSummary;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  compact?: boolean;
}

function CommunityCatchIntelCard({
  summary,
  isLoading = false,
  isError = false,
  onRetry,
  compact = false,
}: CommunityCatchIntelCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (isLoading) {
    return (
      <View style={[styles.card, compact && styles.cardCompact]}>
        <Skeleton width="55%" height={16} />
        <Skeleton width="100%" height={28} borderRadius={BorderRadius.full} />
        <Skeleton width="80%" height={28} borderRadius={BorderRadius.full} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.card, compact && styles.cardCompact]}>
        <ErrorState
          title="Community data unavailable"
          message="Could not load recent angler activity for this spot."
          onRetry={onRetry}
        />
      </View>
    );
  }

  if (summary.totalCatches <= 0) {
    return (
      <View style={[styles.card, compact && styles.cardCompact]}>
        <View style={styles.headerRow}>
          <Users color={colors.accent} size={18} />
          <ThemedText style={styles.title}>Anglers nearby</ThemedText>
        </View>
        <ThemedText style={styles.emptyText}>
          No recent community catches here yet. Log a catch and opt in to help nearby anglers.
        </ThemedText>
      </View>
    );
  }

  return (
    <View
      style={[styles.card, compact && styles.cardCompact]}
      accessibilityLabel={`${summary.totalCatches} community catches nearby in the last ${summary.daysBack} days`}
    >
      <View style={styles.headerRow}>
        <Users color={colors.accent} size={18} />
        <ThemedText style={styles.title}>Anglers nearby</ThemedText>
      </View>
      <ThemedText style={styles.subtitle}>
        {summary.totalCatches} {summary.totalCatches === 1 ? 'catch' : 'catches'} logged nearby in
        the last {summary.daysBack} days
      </ThemedText>

      {summary.speciesBreakdown.length > 0 ? (
        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>{"What's being caught"}</ThemedText>
          <View style={styles.chipRow}>
            {summary.speciesBreakdown.slice(0, compact ? 3 : 5).map((item) => (
              <View key={item.speciesName} style={styles.speciesChip}>
                <Fish color={colors.accent} size={12} />
                <ThemedText style={styles.speciesChipText}>
                  {item.speciesName} ({item.catchCount})
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {summary.topLures.length > 0 ? (
        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Top lures from anglers</ThemedText>
          <View style={styles.chipRow}>
            {summary.topLures.map((lure) => (
              <View key={lure} style={styles.lureChip}>
                <ThemedText style={styles.lureChipText}>{lure}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <ThemedText style={styles.privacyNote}>
        Anonymized aggregates only — no names or exact GPS shared.
      </ThemedText>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    cardCompact: {
      marginBottom: Spacing.sm,
      padding: Spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    title: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      lineHeight: 20,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: FontSizes.sm,
      lineHeight: 20,
    },
    section: {
      gap: Spacing.xs,
    },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    speciesChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.full,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    speciesChipText: {
      color: colors.text,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.medium,
    },
    lureChip: {
      backgroundColor: colors.accentDark,
      borderRadius: BorderRadius.full,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
    },
    lureChipText: {
      color: colors.accent,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.semibold,
    },
    privacyNote: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      lineHeight: 16,
    },
  });
}

export default memo(CommunityCatchIntelCard);
