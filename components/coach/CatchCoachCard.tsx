import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Sparkles, Users, User, MessageCircle } from 'lucide-react-native';
import RigDiagramCard from '@/components/rigs/RigDiagramCard';
import { Button } from '@/components/ui';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import type { CatchCoachAdvice, CoachFactor } from '@/lib/types/catchCoach';
import { getPrimaryRigForName } from '@/utils/speciesRigs';
import { getActivityColor, getActivityLabel } from '@/utils/fishingEngine';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { isCatchAiCoachEnhanceEnabled, isProFeatureEnabled } from '@/constants/features';
import { hostedGenerateText, fetchHostedAiUsage } from '@/lib/ai/hostedAiClient';
import { buildCoachEnhancePrompt, type FishingContextInput } from '@/lib/ai/contextBuilder';
import { PRO_AI_DAILY_LIMIT } from '@/constants/pro';

interface CatchCoachCardProps {
  advice: CatchCoachAdvice | null;
  loading?: boolean;
  compact?: boolean;
  onApplySetup?: (advice: CatchCoachAdvice) => void;
  onAskCatchAi?: () => void;
  coachContext?: FishingContextInput;
}

function FactorChip({
  factor,
  styles,
}: {
  factor: CoachFactor;
  styles: ReturnType<typeof createStyles>;
}) {
  const impactStyle =
    factor.impact === '+'
      ? styles.factorPositive
      : factor.impact === '-'
        ? styles.factorNegative
        : styles.factorNeutral;

  return (
    <View style={styles.factorChip}>
      <Text style={[styles.factorImpact, impactStyle]}>
        {factor.impact === '+' ? '+' : factor.impact === '-' ? '−' : '○'}
      </Text>
      <View style={styles.factorTextBlock}>
        <Text style={styles.factorName}>{factor.name}</Text>
        <Text style={styles.factorDetail} numberOfLines={2}>
          {factor.detail}
        </Text>
      </View>
    </View>
  );
}

export default function CatchCoachCard({
  advice,
  loading = false,
  compact = false,
  onApplySetup,
  onAskCatchAi,
  coachContext,
}: CatchCoachCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [enhancedText, setEnhancedText] = useState<string | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);

  const handleEnhance = async () => {
    if (!advice) return;
    setEnhancing(true);
    setEnhanceError(null);
    try {
      if (!isProFeatureEnabled('hosted_ai')) {
        setEnhanceError('Catch AI enhance requires CatchMap Pro.');
        return;
      }
      const usage = await fetchHostedAiUsage();
      if (usage.remaining <= 0) {
        setEnhanceError(`Daily Pro AI limit reached (${PRO_AI_DAILY_LIMIT}). Try again tomorrow.`);
        return;
      }
      const { text, error } = await hostedGenerateText({
        feature: 'coach_enhance',
        systemPrompt:
          'You are Catch AI, a friendly fishing coach. Rewrite advice clearly in 2-3 short paragraphs.',
        userPrompt: buildCoachEnhancePrompt(advice, coachContext ?? { speciesName: advice.speciesName }),
        temperature: 0.6,
        maxOutputTokens: 512,
      });
      if (error) {
        setEnhanceError(error.message);
        return;
      }
      setEnhancedText(text ?? null);
    } finally {
      setEnhancing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.card, compact && styles.cardCompact]}>
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={styles.loadingText}>Catch Coach is analyzing conditions…</Text>
        </View>
      </View>
    );
  }

  if (!advice) return null;

  const primaryRig = getPrimaryRigForName(advice.speciesName);
  const ratingColor =
    advice.biteRating != null ? getActivityColor(advice.biteRating) : colors.accent;
  const showEnhance = isCatchAiCoachEnhanceEnabled();

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Sparkles color={colors.accent} size={18} />
          <View style={styles.headerText}>
            <Text style={styles.title}>Catch Coach</Text>
            <Text style={styles.headline} numberOfLines={2}>
              {advice.headline}
            </Text>
          </View>
        </View>
        {advice.biteRating != null ? (
          <View style={[styles.ratingPill, { backgroundColor: ratingColor }]}>
            <Text style={styles.ratingText}>{getActivityLabel(advice.biteRating)}</Text>
          </View>
        ) : null}
      </View>

      {enhancedText ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Catch AI insight</Text>
          <Text style={styles.bodyText}>{enhancedText}</Text>
        </View>
      ) : null}

      {primaryRig ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended setup</Text>
          <RigDiagramCard rig={primaryRig} compact={compact} />
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended setup</Text>
          <Text style={styles.setupName}>{advice.setup.rigName}</Text>
          <Text style={styles.setupDetail}>Use: {advice.setup.lureLabel}</Text>
          {advice.setup.retrieve ? (
            <Text style={styles.setupDetail}>Retrieve: {advice.setup.retrieve}</Text>
          ) : null}
        </View>
      )}

      {advice.technique ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Technique</Text>
          <Text style={styles.bodyText} numberOfLines={compact ? 3 : undefined}>
            {advice.technique}
          </Text>
        </View>
      ) : null}

      {advice.whyNow.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Why now</Text>
          {advice.whyNow.slice(0, compact ? 3 : 5).map((factor) => (
            <FactorChip key={`${factor.name}-${factor.detail}`} factor={factor} styles={styles} />
          ))}
        </View>
      ) : null}

      {advice.community ? (
        <View style={styles.insightRow}>
          <Users color={colors.accent} size={16} />
          <Text style={styles.insightText}>
            {advice.community.catchCount} nearby catch
            {advice.community.catchCount === 1 ? '' : 'es'}
            {advice.community.topLures[0]
              ? ` — top lure: ${advice.community.topLures[0]}`
              : ''}
          </Text>
        </View>
      ) : null}

      {advice.personal ? (
        <View style={styles.insightRow}>
          <User color={colors.warning} size={16} />
          <Text style={styles.insightText}>{advice.personal.message}</Text>
        </View>
      ) : null}

      {!advice.hasCatalogData ? (
        <Text style={styles.limitedData}>
          Limited tackle data for this species — advice is based on conditions and history.
        </Text>
      ) : null}

      {enhanceError ? <Text style={styles.enhanceError}>{enhanceError}</Text> : null}

      <View style={styles.actionRow}>
        {onApplySetup ? (
          <Button
            title="Apply setup"
            onPress={() => onApplySetup(advice)}
            variant="secondary"
            style={styles.actionButton}
          />
        ) : null}
        {showEnhance && !enhancedText ? (
          <Button
            title={enhancing ? 'Enhancing…' : 'Enhance with Catch AI'}
            onPress={handleEnhance}
            loading={enhancing}
            variant="secondary"
            style={styles.actionButton}
            icon={<Sparkles color={colors.accent} size={16} />}
          />
        ) : null}
        {onAskCatchAi ? (
          <TouchableOpacity
            style={styles.askAiLink}
            onPress={onAskCatchAi}
            accessibilityRole="button"
            accessibilityLabel="Ask Catch AI"
          >
            <MessageCircle color={colors.accent} size={16} />
            <Text style={styles.askAiText}>Ask Catch AI</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.accentDark,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      gap: Spacing.sm,
    },
    cardCompact: {
      padding: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.sm,
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
    title: {
      color: colors.accent,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    headline: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
    },
    ratingPill: {
      borderRadius: BorderRadius.full,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
    },
    ratingText: {
      color: colors.accentForeground,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.bold,
    },
    section: {
      gap: Spacing.xs,
    },
    sectionTitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    setupName: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
    },
    setupDetail: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
    },
    bodyText: {
      color: colors.text,
      fontSize: FontSizes.sm,
      lineHeight: 20,
    },
    factorChip: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.xs,
      paddingVertical: 2,
    },
    factorImpact: {
      width: 16,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.bold,
      textAlign: 'center',
    },
    factorPositive: {
      color: colors.success,
    },
    factorNegative: {
      color: colors.error,
    },
    factorNeutral: {
      color: colors.textSecondary,
    },
    factorTextBlock: {
      flex: 1,
    },
    factorName: {
      color: colors.text,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    factorDetail: {
      color: colors.textSecondary,
      fontSize: FontSizes.xs,
    },
    insightRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.xs,
    },
    insightText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      lineHeight: 18,
    },
    limitedData: {
      color: colors.textSecondary,
      fontSize: FontSizes.xs,
      fontStyle: 'italic',
    },
    enhanceError: {
      color: colors.warning,
      fontSize: FontSizes.xs,
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    actionButton: {
      flexGrow: 0,
    },
    askAiLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.xs,
    },
    askAiText: {
      color: colors.accent,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
  });
}
