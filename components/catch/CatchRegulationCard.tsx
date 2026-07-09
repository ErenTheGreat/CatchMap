import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle2, Scale, ShieldAlert } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import RegulationNoticeCard from '@/components/map/RegulationNoticeCard';
import type { CatchRegulationCheck } from '@/lib/types/fishingRegulations';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';

interface CatchRegulationCardProps {
  check: CatchRegulationCheck;
}

function seasonLabel(status: CatchRegulationCheck['seasonStatus']): string {
  switch (status) {
    case 'open':
      return 'In season';
    case 'closed':
      return 'May be closed';
    default:
      return 'Season unknown';
  }
}

export default function CatchRegulationCard({ check }: CatchRegulationCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (check.notices.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <ShieldAlert color={colors.accent} size={18} />
        <Text style={styles.headerTitle}>Regulations check</Text>
      </View>

      {(check.seasonStatus !== 'unknown' || check.bagLimit != null || check.sizeCheck?.minSizeInches != null) && (
        <View style={styles.summaryRow}>
          {check.seasonStatus !== 'unknown' ? (
            <View
              style={[
                styles.summaryChip,
                check.seasonStatus === 'closed' ? styles.summaryChipWarning : styles.summaryChipOk,
              ]}
            >
              {check.seasonStatus === 'open' ? (
                <CheckCircle2 color={colors.success} size={14} />
              ) : (
                <ShieldAlert color={colors.warning} size={14} />
              )}
              <Text style={styles.summaryChipText}>{seasonLabel(check.seasonStatus)}</Text>
            </View>
          ) : null}

          {check.bagLimit != null ? (
            <View style={styles.summaryChip}>
              <Scale color={colors.textSecondary} size={14} />
              <Text style={styles.summaryChipText}>
                Bag limit: {check.bagLimit}
                {check.bagLimitNote ? '*' : ''}
              </Text>
            </View>
          ) : null}

          {check.sizeCheck?.minSizeInches != null ? (
            <View
              style={[
                styles.summaryChip,
                check.sizeCheck.passes === false ? styles.summaryChipWarning : undefined,
              ]}
            >
              <Text style={styles.summaryChipText}>
                Min size: {check.sizeCheck.minSizeInches} in
                {check.sizeCheck.passes === false ? ' (below limit)' : ''}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {check.bagLimitNote ? (
        <Text style={styles.bagLimitNote}>* {check.bagLimitNote}</Text>
      ) : null}

      <RegulationNoticeCard notices={check.notices} />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: Spacing.md,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: Spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    headerTitle: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
    },
    summaryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    summaryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.cardLight,
    },
    summaryChipOk: {
      backgroundColor: colors.successSurface,
    },
    summaryChipWarning: {
      backgroundColor: colors.warningSurface,
    },
    summaryChipText: {
      color: colors.textSecondary,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.medium,
    },
    bagLimitNote: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      marginBottom: Spacing.sm,
      lineHeight: 16,
    },
  });
}
