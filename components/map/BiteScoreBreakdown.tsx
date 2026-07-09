import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import AccessibleText from '@/components/ui/AccessibleText';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import type { BestTimeFactor } from '@/utils/bestTimeNow';
import { getActivityColor } from '@/utils/fishingEngine';
import type { SpotDiscoveryScore } from '@/utils/spotDiscoveryScore';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';

interface BiteScoreBreakdownProps {
  score: Pick<
    SpotDiscoveryScore,
    'activityRating' | 'label' | 'period' | 'summary' | 'tip' | 'factors'
  >;
  spotName?: string;
  /** Start expanded (e.g. on spot detail). */
  defaultExpanded?: boolean;
  compact?: boolean;
  /** e.g. "Conditions at this spot" vs "Compared to nearby spots on map". */
  contextLabel?: string;
}

function FactorRow({
  factor,
  styles,
}: {
  factor: BestTimeFactor;
  styles: ReturnType<typeof createStyles>;
}) {
  const impactStyle =
    factor.impact === '+'
      ? styles.factorPositive
      : factor.impact === '-'
        ? styles.factorNegative
        : styles.factorNeutral;

  return (
    <View style={styles.factorRow}>
      <AccessibleText style={[styles.factorImpact, impactStyle]}>
        {factor.impact === '+' ? '+' : factor.impact === '-' ? '−' : '○'}
      </AccessibleText>
      <View style={styles.factorTextBlock}>
        <AccessibleText style={styles.factorName}>{factor.name}</AccessibleText>
        <AccessibleText style={styles.factorDetail}>{factor.detail}</AccessibleText>
      </View>
    </View>
  );
}

export default function BiteScoreBreakdown({
  score,
  spotName,
  defaultExpanded = false,
  compact = false,
  contextLabel,
}: BiteScoreBreakdownProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const factors = score.factors ?? [];
  const ratingColor = getActivityColor(score.activityRating);
  const title = spotName ? `Why ${spotName} is ${score.label.toLowerCase()}` : `Why it's ${score.label.toLowerCase()}`;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <Pressable
        style={styles.header}
        onPress={() => setExpanded((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${expanded ? 'Collapse' : 'Expand'} score breakdown`}
        accessibilityState={{ expanded }}
      >
        <View style={styles.headerLeft}>
          <HelpCircle color={colors.accent} size={18} />
          <View style={styles.headerText}>
            <AccessibleText style={styles.title}>{title}</AccessibleText>
            <AccessibleText style={styles.subtitle} numberOfLines={expanded ? undefined : 1}>
              {contextLabel ? `${contextLabel} · ` : ''}
              {score.summary || `${score.label} · ${score.period}`}
            </AccessibleText>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.ratingPill, { backgroundColor: `${ratingColor}22` }]}>
            <AccessibleText style={[styles.ratingPillText, { color: ratingColor }]}>
              {score.label}
            </AccessibleText>
          </View>
          {expanded ? (
            <ChevronUp color={colors.textMuted} size={18} />
          ) : (
            <ChevronDown color={colors.textMuted} size={18} />
          )}
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          {score.tip ? <AccessibleText style={styles.tip}>{score.tip}</AccessibleText> : null}
          {factors.length > 0 ? (
            <View style={styles.factorList}>
              {factors.map((factor) => (
                <FactorRow key={`${factor.name}-${factor.detail}`} factor={factor} styles={styles} />
              ))}
            </View>
          ) : (
            <AccessibleText style={styles.emptyFactors}>
              Score is based on season, weather, and time of day for this spot.
            </AccessibleText>
          )}
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
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    cardCompact: {
      marginHorizontal: Spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      padding: Spacing.md,
    },
    headerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    title: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      color: colors.text,
    },
    subtitle: {
      fontSize: FontSizes.xs,
      color: colors.textSecondary,
    },
    ratingPill: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.full,
    },
    ratingPillText: {
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.bold,
    },
    body: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.md,
      gap: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    tip: {
      fontSize: FontSizes.sm,
      color: colors.text,
      lineHeight: 20,
      paddingTop: Spacing.sm,
    },
    factorList: {
      gap: Spacing.sm,
    },
    factorRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    factorImpact: {
      width: 18,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.bold,
      textAlign: 'center',
      marginTop: 1,
    },
    factorPositive: {
      color: colors.success,
    },
    factorNegative: {
      color: colors.error,
    },
    factorNeutral: {
      color: colors.textMuted,
    },
    factorTextBlock: {
      flex: 1,
      gap: 2,
    },
    factorName: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      color: colors.text,
    },
    factorDetail: {
      fontSize: FontSizes.xs,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    emptyFactors: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
      paddingTop: Spacing.sm,
    },
  });
}
