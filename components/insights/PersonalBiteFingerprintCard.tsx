import React from 'react';
import { View, StyleSheet } from 'react-native';
import AccessibleText from '@/components/ui/AccessibleText';
import { Fingerprint, Sparkles } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import type { PersonalBiteFingerprint } from '@/lib/types/personalBite';
import { MIN_CATCHES_FOR_FINGERPRINT } from '@/lib/types/personalBite';
import { fingerprintNeedsProUnlock } from '@/lib/pro/proInsights';
import ProUpsellCard from '@/components/pro/ProUpsellCard';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';

interface PersonalBiteFingerprintCardProps {
  fingerprint: PersonalBiteFingerprint;
  compact?: boolean;
}

export default function PersonalBiteFingerprintCard({
  fingerprint,
  compact = false,
}: PersonalBiteFingerprintCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (!fingerprint.unlocked) {
    const logged = fingerprint.totalCatchesWithConditions;
    if (fingerprintNeedsProUnlock(fingerprint)) {
      return (
        <ProUpsellCard
          compact={compact}
          title="Bite fingerprint ready"
          description="You've logged enough conditioned catches. Pro unlocks your personal bite patterns and pattern-match alerts."
        />
      );
    }
    return (
      <View style={[styles.unlockCard, compact && styles.compact]}>
        <Fingerprint color={colors.textMuted} size={compact ? 18 : 20} />
        <AccessibleText style={styles.unlockTitle}>Personal bite fingerprint</AccessibleText>
        <AccessibleText style={styles.unlockText}>
          Log {fingerprint.catchesUntilUnlock} more{' '}
          {fingerprint.catchesUntilUnlock === 1 ? 'catch' : 'catches'} with weather conditions to
          learn what works for you — not the average angler.
        </AccessibleText>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(100, (logged / MIN_CATCHES_FOR_FINGERPRINT) * 100)}%`,
              },
            ]}
          />
        </View>
        <AccessibleText style={styles.progressLabel}>
          {logged} of {MIN_CATCHES_FOR_FINGERPRINT} conditioned catches
        </AccessibleText>
      </View>
    );
  }

  return (
    <View style={[styles.container, compact && styles.compact]}>
      <View style={styles.headerRow}>
        <Fingerprint color={colors.accent} size={compact ? 16 : 18} />
        <AccessibleText style={styles.title}>Your bite fingerprint</AccessibleText>
      </View>
      <AccessibleText style={styles.headline}>{fingerprint.headline}</AccessibleText>

      {fingerprint.topFactors.length > 0 && (
        <View style={styles.factorRow}>
          {fingerprint.topFactors.map((factor) => (
            <View key={`${factor.category}-${factor.value}`} style={styles.factorChip}>
              <AccessibleText style={styles.factorChipText}>{factor.label}</AccessibleText>
              <AccessibleText style={styles.factorPct}>{Math.round(factor.weight * 100)}%</AccessibleText>
            </View>
          ))}
        </View>
      )}

      {!compact && fingerprint.speciesPatterns.length > 0 && (
        <View style={styles.speciesBlock}>
          <View style={styles.speciesHeader}>
            <Sparkles color={colors.warning} size={14} />
            <AccessibleText style={styles.speciesTitle}>By species</AccessibleText>
          </View>
          {fingerprint.speciesPatterns.slice(0, 3).map((pattern) => (
            <View key={pattern.species} style={styles.speciesRow}>
              <AccessibleText style={styles.speciesName}>{pattern.species}</AccessibleText>
              <AccessibleText style={styles.speciesDetail} numberOfLines={2}>
                {pattern.headline.replace(`Your best ${pattern.species} window: `, '')}
              </AccessibleText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      gap: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.accentDark,
    },
    compact: {
      marginBottom: Spacing.sm,
      padding: Spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    title: {
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      color: colors.text,
    },
    headline: {
      fontSize: FontSizes.sm,
      color: colors.text,
      lineHeight: 20,
    },
    factorRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    factorChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.accentDark,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.full,
    },
    factorChipText: {
      fontSize: FontSizes.xs,
      color: colors.accent,
      fontWeight: FontWeights.medium,
      maxWidth: 160,
    },
    factorPct: {
      fontSize: FontSizes.xs,
      color: colors.textMuted,
    },
    speciesBlock: {
      marginTop: Spacing.xs,
      gap: Spacing.xs,
    },
    speciesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    speciesTitle: {
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    speciesRow: {
      gap: 2,
    },
    speciesName: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
      color: colors.text,
    },
    speciesDetail: {
      fontSize: FontSizes.xs,
      color: colors.textMuted,
      lineHeight: 16,
    },
    unlockCard: {
      alignItems: 'center',
      backgroundColor: colors.cardLight,
      padding: Spacing.lg,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.md,
      gap: Spacing.sm,
    },
    unlockTitle: {
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      color: colors.text,
    },
    unlockText: {
      fontSize: FontSizes.sm,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
    progressTrack: {
      alignSelf: 'stretch',
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
  });
}
