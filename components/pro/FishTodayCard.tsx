import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar, Check, Crown, Fish, MapPin, Sparkles, Bell, BellOff } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { Button, useToast } from '@/components/ui';
import { isFishTodayBundleEnabled } from '@/constants/features';
import { generateAiFishTodayRanking } from '@/lib/ai/proAiFeatures';
import { PRO_UPGRADE_HREF } from '@/constants/routes';
import { usePro } from '@/providers/ProProvider';
import type { PersonalSpeciesNear } from '@/lib/types/catchInsights';
import type { DataConfidence, SpeciesPrediction } from '@/lib/types/speciesPrediction';
import { getActivityRatingColor } from '@/lib/types/speciesPrediction';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import type { NearbySpot } from '@/utils/recommendations';
import {
  rankTodaySpeciesTargets,
  type TodaySpeciesTarget,
} from '@/utils/rankTodaySpeciesTargets';
import { getHourBucket } from '@/utils/spotDiscoveryScore';
import type { RankedDiscoverySpot } from '@/utils/spotDiscoveryScore';
import { computeFishTodayVerdict } from '@/utils/fishTodayVerdict';
import { useTripReminder } from '@/hooks/useTripReminder';
import { formatReminderTime } from '@/utils/tripReminders';
import { hapticLight } from '@/utils/haptics';

const FISH_TODAY_UPSELL_FEATURES = [
  'Go/No-Go daily verdict',
  'Top 3 species targets for your map',
  'Best spot + rig + bite-window reminders',
  'Personal catch-history weighting',
  'AI trip briefing',
] as const;

const aiBriefCache = new Map<string, string>();

interface FishTodayCardProps {
  rankedSpots: RankedDiscoverySpot[];
  topSpots: RankedDiscoverySpot[];
  speciesBySpotId: Record<string, SpeciesPrediction[]>;
  personalSpecies?: PersonalSpeciesNear[];
  weather?: WeatherSnapshot | null;
  isEnriching?: boolean;
  onSpotPress?: (spot: NearbySpot) => void;
  onLogCatch?: (spot: NearbySpot, speciesName: string) => void;
}

function getConfidenceLabel(confidence: DataConfidence): string {
  switch (confidence) {
    case 'high':
      return 'Verified spot data';
    case 'medium':
      return 'Regional records';
    default:
      return 'Estimate';
  }
}

function buildAiCacheKey(
  hourBucket: string,
  spots: RankedDiscoverySpot[],
  targets: TodaySpeciesTarget[]
): string {
  const spotIds = spots
    .slice(0, 3)
    .map((item) => item.spot.id)
    .join(',');
  const speciesIds = targets.map((item) => item.speciesId).join(',');
  return `${hourBucket}:${spotIds}:${speciesIds}`;
}

function FishTodayUpsell() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { monthlyPriceLabel, priceLabel } = usePro();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Crown color={colors.accent} size={18} />
        <Text style={styles.title}>What should I fish today?</Text>
      </View>
      <Text style={styles.hint}>
        Your daily fishing guide — species, spots, rigs, bite windows, and an AI briefing.
      </Text>
      <View style={styles.checklist}>
        {FISH_TODAY_UPSELL_FEATURES.map((feature) => (
          <View key={feature} style={styles.checklistRow}>
            <Check color={colors.accent} size={16} />
            <Text style={styles.checklistText}>{feature}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.pricingNote}>
        From {monthlyPriceLabel} — or {priceLabel} lifetime
      </Text>
      <Button
        title={`Subscribe — ${monthlyPriceLabel}`}
        onPress={() => router.push(PRO_UPGRADE_HREF)}
        variant="secondary"
      />
    </View>
  );
}

export default function FishTodayCard({
  rankedSpots,
  topSpots,
  speciesBySpotId,
  personalSpecies,
  weather,
  isEnriching = false,
  onSpotPress,
  onLogCatch,
}: FishTodayCardProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const autoBriefAttemptedRef = useRef<string | null>(null);

  const hourBucket = getHourBucket();
  const targets = useMemo(
    () =>
      rankTodaySpeciesTargets({
        rankedSpots,
        speciesBySpotId,
        personalSpecies,
      }),
    [rankedSpots, speciesBySpotId, personalSpecies]
  );

  const verdict = useMemo(() => computeFishTodayVerdict(targets), [targets]);

  const featuredSpotIds = useMemo(
    () => new Set(targets.map((target) => target.bestSpot.id)),
    [targets]
  );

  const extraHotSpots = useMemo(
    () => topSpots.filter((item) => !featuredSpotIds.has(item.spot.id)).slice(0, 3),
    [topSpots, featuredSpotIds]
  );

  const spotsForAi = topSpots.length > 0 ? topSpots : rankedSpots.slice(0, 3);
  const aiCacheKey = useMemo(
    () => buildAiCacheKey(hourBucket, spotsForAi, targets),
    [hourBucket, spotsForAi, targets]
  );

  const runAiBriefing = useCallback(
    async (force = false) => {
      if (spotsForAi.length === 0 && targets.length === 0) return;

      if (!force) {
        const cached = aiBriefCache.get(aiCacheKey);
        if (cached) {
          setAiResult(cached);
          return;
        }
      }

      setAiLoading(true);
      setAiError(null);
      const { text, error } = await generateAiFishTodayRanking(
        spotsForAi,
        weather,
        targets
      );
      setAiLoading(false);
      if (error) {
        setAiError(error);
        return;
      }
      if (text) {
        aiBriefCache.set(aiCacheKey, text);
        setAiResult(text);
      }
    },
    [aiCacheKey, spotsForAi, targets, weather]
  );

  useEffect(() => {
    if (!isFishTodayBundleEnabled()) return;
    if (targets.length === 0 && spotsForAi.length === 0) return;
    if (autoBriefAttemptedRef.current === aiCacheKey) return;

    autoBriefAttemptedRef.current = aiCacheKey;
    const cached = aiBriefCache.get(aiCacheKey);
    if (cached) {
      setAiResult(cached);
      return;
    }
    void runAiBriefing(false);
  }, [aiCacheKey, targets.length, spotsForAi.length, runAiBriefing]);

  const handlePlanTrip = useCallback(
    (spot: NearbySpot) => {
      router.push({
        pathname: '/trip-planner',
        params: {
          lat: String(spot.latitude),
          lng: String(spot.longitude),
        },
      });
    },
    [router]
  );

  if (!isFishTodayBundleEnabled()) {
    return <FishTodayUpsell />;
  }

  const enrichedSpotCount = Object.keys(speciesBySpotId).length;
  const showAiSection = spotsForAi.length > 0 || targets.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerIcons}>
          <Fish color={colors.accent} size={18} />
          <Sparkles color={colors.accent} size={16} />
        </View>
        <Text style={styles.title}>What should I fish today?</Text>
      </View>

      <Text style={styles.hint}>
        Your daily plan — species, spots, rigs, and bite windows from live scoring.
      </Text>

      {targets.length > 0 ? (
        <View
          style={[
            styles.verdictBanner,
            verdict.verdict === 'go_now' && styles.verdictGo,
            verdict.verdict === 'marginal' && styles.verdictMarginal,
          ]}
        >
          <Text
            style={[
              styles.verdictHeadline,
              verdict.verdict === 'go_now' && { color: colors.activityHigh },
            ]}
          >
            {verdict.headline}
          </Text>
          <Text style={styles.verdictDetail}>{verdict.detail}</Text>
        </View>
      ) : null}

      {isEnriching && targets.length === 0 ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={styles.loadingText}>Scoring species for nearby waters…</Text>
        </View>
      ) : null}

      {!isEnriching && enrichedSpotCount === 0 && targets.length === 0 ? (
        <Text style={styles.emptyText}>
          Pan over fishing waters and wait a few seconds for scoring to finish.
        </Text>
      ) : null}

      {targets.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>What to target</Text>
          {targets.map((target, index) => (
            <SpeciesTargetRow
              key={target.speciesId}
              target={target}
              index={index}
              styles={styles}
              colors={colors}
              onSpotPress={onSpotPress}
              onPlanTrip={handlePlanTrip}
              onLogCatch={onLogCatch}
            />
          ))}
        </View>
      ) : null}

      {extraHotSpots.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Where to go</Text>
          {extraHotSpots.map((item, index) => (
            <TouchableOpacity
              key={item.spot.id}
              style={styles.hotSpotRow}
              onPress={() => onSpotPress?.(item.spot)}
              accessibilityRole="button"
              accessibilityLabel={`${item.spot.name}, ${item.score.label} bite`}
            >
              <Text style={styles.hotSpotRank}>{index + 1}.</Text>
              <View style={styles.hotSpotBody}>
                <Text style={styles.hotSpotName} numberOfLines={1}>
                  {item.spot.name}
                </Text>
                <Text style={styles.hotSpotMeta}>
                  {item.score.label} bite · {item.spot.distance?.toFixed(1) ?? '?'} mi
                  {item.score.topSpeciesHint ? ` · Likely ${item.score.topSpeciesHint}` : ''}
                </Text>
              </View>
              <MapPin color={colors.textSecondary} size={14} />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {showAiSection ? (
        <View style={styles.aiSection}>
          {aiLoading && !aiResult ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={styles.loadingText}>Building your briefing…</Text>
            </View>
          ) : null}
          {aiResult ? <Text style={styles.aiResult}>{aiResult}</Text> : null}
          {aiError ? <Text style={styles.aiError}>{aiError}</Text> : null}
          <Button
            title={aiLoading ? 'Thinking…' : aiResult ? 'Refresh briefing' : 'AI trip briefing'}
            onPress={() => void runAiBriefing(true)}
            loading={aiLoading}
            variant="secondary"
          />
        </View>
      ) : null}
    </View>
  );
}

function SpeciesTargetRow({
  target,
  index,
  styles,
  colors,
  onSpotPress,
  onPlanTrip,
  onLogCatch,
}: {
  target: TodaySpeciesTarget;
  index: number;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  onSpotPress?: (spot: NearbySpot) => void;
  onPlanTrip?: (spot: NearbySpot) => void;
  onLogCatch?: (spot: NearbySpot, speciesName: string) => void;
}) {
  const ratingColor = getActivityRatingColor(target.activityRating);
  const factorLine = target.factors
    .slice(0, 2)
    .map((factor) => factor.detail)
    .join(' · ');

  return (
    <View style={styles.targetRow}>
      <View style={styles.targetHeader}>
        <Text style={styles.targetRank}>{index + 1}.</Text>
        <View style={styles.targetTitleBlock}>
          <Text style={styles.targetName}>{target.speciesName}</Text>
          <Text style={[styles.targetScore, { color: ratingColor }]}>
            {target.matchScore}% match · {target.probability}% activity
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.spotRow}
        onPress={() => onSpotPress?.(target.bestSpot)}
        accessibilityRole="button"
        accessibilityLabel={`Best spot for ${target.speciesName}, ${target.bestSpot.name}`}
      >
        <MapPin color={colors.accent} size={14} />
        <Text style={styles.spotText} numberOfLines={1}>
          {target.bestSpot.name} · {target.bestSpotBiteLabel} bite
        </Text>
      </TouchableOpacity>

      {target.goNowLabel ? (
        <Text
          style={[
            styles.windowText,
            target.goNowLabel.startsWith('Go now') && { color: colors.activityHigh },
          ]}
        >
          {target.goNowLabel}
        </Text>
      ) : null}

      {target.rigLabel ? (
        <Text style={styles.rigText}>
          Rig: {target.rigLabel}
          {target.rigTypeLabel ? ` (${target.rigTypeLabel})` : ''}
        </Text>
      ) : null}

      {factorLine ? <Text style={styles.factorText}>{factorLine}</Text> : null}

      <Text style={styles.metaText}>
        {getConfidenceLabel(target.dataConfidence)}
        {target.personalMatch ? ' · Matches your log history' : ''}
        {target.supportingSpotCount > 1
          ? ` · ${target.supportingSpotCount} spots in view`
          : ''}
      </Text>

      <View style={styles.actionRow}>
        <FishTodayReminderButton target={target} styles={styles} colors={colors} />
        {onPlanTrip ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onPlanTrip(target.bestSpot)}
            accessibilityRole="button"
            accessibilityLabel={`Plan trip to ${target.bestSpot.name}`}
          >
            <Calendar color={colors.accent} size={14} />
            <Text style={styles.actionText}>Plan trip</Text>
          </TouchableOpacity>
        ) : null}
        {onLogCatch ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onLogCatch(target.bestSpot, target.speciesName)}
            accessibilityRole="button"
            accessibilityLabel={`Log ${target.speciesName} catch`}
          >
            <Fish color={colors.accent} size={14} />
            <Text style={styles.actionText}>Log catch</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function FishTodayReminderButton({
  target,
  styles,
  colors,
}: {
  target: TodaySpeciesTarget;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const { showToast } = useToast();
  const now = Date.now();
  const canRemind =
    target.bestWindow != null &&
    target.bestWindow.startTime.getTime() > now &&
    !target.goNowLabel.startsWith('Go now');

  const { isScheduled, loading, schedule, cancel } = useTripReminder(
    canRemind ? target.bestWindow : null,
    target.bestSpot.name,
    {
      latitude: target.bestSpot.latitude,
      longitude: target.bestSpot.longitude,
    },
    target.speciesName
  );

  if (!canRemind) return null;

  const handleReminder = async () => {
    hapticLight();
    if (isScheduled) {
      await cancel();
      showToast({ message: 'Bite window reminder cancelled' });
      return;
    }
    const result = await schedule();
    if (result.ok) {
      showToast({
        message: `Reminder set for ${formatReminderTime(result.fireAt)}`,
        variant: 'success',
      });
      return;
    }
    const messages: Record<typeof result.reason, string> = {
      past: 'This bite window has already started',
      permission_denied: 'Enable notifications in Settings to get bite reminders',
      unavailable: 'Could not schedule reminder on this device',
      web: 'Reminders are available in the mobile app',
    };
    showToast({ message: messages[result.reason], variant: 'warning' });
  };

  return (
    <TouchableOpacity
      style={styles.actionButton}
      onPress={() => void handleReminder()}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={isScheduled ? 'Cancel bite reminder' : 'Remind me before bite window'}
    >
      {isScheduled ? (
        <BellOff color={colors.accent} size={14} />
      ) : (
        <Bell color={colors.accent} size={14} />
      )}
      <Text style={styles.actionText}>{isScheduled ? 'Cancel remind' : 'Remind me'}</Text>
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
    headerIcons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
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
    verdictBanner: {
      backgroundColor: colors.background,
      borderRadius: BorderRadius.md,
      padding: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    verdictGo: {
      borderColor: colors.activityHigh,
    },
    verdictMarginal: {
      opacity: 0.9,
    },
    verdictHeadline: {
      fontSize: FontSizes.md,
      fontWeight: FontWeights.bold,
      color: colors.text,
    },
    verdictDetail: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    checklist: {
      gap: Spacing.xs,
      marginTop: Spacing.xs,
    },
    checklistRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    checklistText: {
      flex: 1,
      fontSize: FontSizes.sm,
      color: colors.text,
      lineHeight: 20,
    },
    pricingNote: {
      fontSize: FontSizes.xs,
      color: colors.textMuted,
      marginTop: Spacing.xs,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    loadingText: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
    },
    emptyText: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    section: {
      gap: Spacing.xs,
      paddingTop: Spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    sectionLabel: {
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.semibold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 2,
    },
    targetRow: {
      gap: 4,
      paddingVertical: Spacing.xs,
    },
    targetHeader: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    targetRank: {
      fontSize: FontSizes.md,
      fontWeight: FontWeights.bold,
      color: colors.accent,
      width: 18,
    },
    targetTitleBlock: {
      flex: 1,
      gap: 2,
    },
    targetName: {
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      color: colors.text,
    },
    targetScore: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    spotRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginLeft: 26,
    },
    spotText: {
      flex: 1,
      fontSize: FontSizes.sm,
      color: colors.text,
    },
    windowText: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      color: colors.text,
      marginLeft: 26,
    },
    rigText: {
      fontSize: FontSizes.sm,
      color: colors.text,
      fontWeight: FontWeights.medium,
      marginLeft: 26,
    },
    factorText: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
      lineHeight: 18,
      marginLeft: 26,
    },
    metaText: {
      fontSize: FontSizes.xs,
      color: colors.textSecondary,
      marginLeft: 26,
    },
    actionRow: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginLeft: 26,
      marginTop: 4,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
    },
    actionText: {
      fontSize: FontSizes.sm,
      color: colors.accent,
      fontWeight: FontWeights.medium,
    },
    hotSpotRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: 6,
    },
    hotSpotRank: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.bold,
      color: colors.accent,
      width: 18,
    },
    hotSpotBody: {
      flex: 1,
      gap: 2,
    },
    hotSpotName: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      color: colors.text,
    },
    hotSpotMeta: {
      fontSize: FontSizes.xs,
      color: colors.textSecondary,
    },
    aiSection: {
      gap: Spacing.sm,
      paddingTop: Spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    aiResult: {
      fontSize: FontSizes.sm,
      color: colors.text,
      lineHeight: 22,
    },
    aiError: {
      fontSize: FontSizes.sm,
      color: colors.error,
    },
  });
}
