import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Clock,
  Cloud,
  Thermometer,
  Wind,
  Waves,
  Sunrise,
  Sunset,
} from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import type { BestTimeNowResult } from '@/utils/bestTimeNow';
import { getActivityColor } from '@/utils/fishingEngine';
import BiteTimeChart from '@/components/map/BiteTimeChart';
import { ThemedText } from '@/components/ui';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { useUnits } from '@/providers/UnitsProvider';

interface FishingNowCardProps {
  bestTime: BestTimeNowResult;
  weather?: WeatherSnapshot | null;
}

function ActivityBar({
  rating,
  styles,
  colors,
}: {
  rating: 1 | 2 | 3 | 4 | 5;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  return (
    <View
      style={styles.activityBarTrack}
      accessibilityLabel={`Activity level ${rating} out of 5, ${getActivityLabelForRating(rating)}`}
    >
      {[1, 2, 3, 4, 5].map((step) => (
        <View
          key={step}
          style={[
            styles.activityBarSegment,
            { backgroundColor: step <= rating ? getActivityColor(rating) : colors.border },
          ]}
        />
      ))}
    </View>
  );
}

function FactorChip({
  name,
  impact,
  detail,
  styles,
  colors,
}: {
  name: string;
  impact: '+' | '-' | 'neutral';
  detail: string;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const impactColor =
    impact === '+' ? colors.success : impact === '-' ? colors.error : colors.textMuted;
  const impactLabel =
    impact === '+' ? 'positive' : impact === '-' ? 'negative' : 'neutral';
  return (
    <View
      style={styles.factorChip}
      accessibilityLabel={`${name}: ${impactLabel} impact, ${detail}`}
    >
      <ThemedText style={[styles.factorImpact, { color: impactColor }]}>
        {impact === 'neutral' ? '=' : impact}
      </ThemedText>
      <View style={styles.factorTextBlock}>
        <ThemedText style={styles.factorName}>{name}</ThemedText>
        <ThemedText style={styles.factorDetail} numberOfLines={1}>
          {detail}
        </ThemedText>
      </View>
    </View>
  );
}

export default function FishingNowCard({ bestTime, weather }: FishingNowCardProps) {
  const { colors } = useTheme();
  const { formatTemperature } = useUnits();
  const styles = useThemedStyles(createStyles);
  const [selectedHourIndex, setSelectedHourIndex] = useState<number | null>(null);

  const displayTip =
    selectedHourIndex != null
      ? (() => {
          const slot = bestTime.dailyCurve?.points[selectedHourIndex];
          if (!slot) return bestTime.tip;
          const label = getActivityLabelForRating(slot.rating);
          const parts = [slot.period, ...(slot.highlights ?? [])].filter(Boolean);
          const detail = parts.length > 0 ? parts.join(' · ') : label;
          return `${slot.isNow ? 'Now' : slot.hourLabel}: ${label} activity · ${detail}`;
        })()
      : bestTime.tip;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View
          style={styles.ratingBadge}
          accessibilityLabel={`Fishing activity: ${bestTime.label}`}
        >
          <ThemedText style={[styles.ratingBadgeText, { color: getActivityColor(bestTime.activityRating) }]}>
            {bestTime.label.toUpperCase()}
          </ThemedText>
        </View>
          <ThemedText style={styles.period} maxFontSizeMultiplier={1.5}>{bestTime.period}</ThemedText>
      </View>

      <ActivityBar rating={bestTime.activityRating} styles={styles} colors={colors} />

      {bestTime.solarTimeline && (
        <View style={styles.timelineBlock}>
          <View style={styles.timelineLabels}>
            <View style={styles.timelineLabelRow}>
              <Sunrise color={colors.textMuted} size={12} />
              <ThemedText style={styles.timelineLabel}>{bestTime.solarTimeline.sunriseLabel}</ThemedText>
            </View>
            <View style={styles.timelineLabelRow}>
              <Sunset color={colors.textMuted} size={12} />
              <ThemedText style={styles.timelineLabel}>{bestTime.solarTimeline.sunsetLabel}</ThemedText>
            </View>
          </View>
          <View style={styles.timelineTrack}>
            <View
              style={[
                styles.timelineFill,
                { width: `${bestTime.solarTimeline.progress * 100}%` },
              ]}
            />
            <View
              style={[
                styles.timelineMarker,
                { left: `${bestTime.solarTimeline.progress * 100}%` },
              ]}
            />
          </View>
        </View>
      )}

      {bestTime.nextWindow && bestTime.nextWindow.startsInMinutes > 0 && (
        <View style={styles.nextWindowRow}>
          <Clock color={colors.accent} size={14} />
          <ThemedText style={styles.nextWindowText}>
            {bestTime.nextWindow.label} starts in {formatMinutes(bestTime.nextWindow.startsInMinutes)}
          </ThemedText>
        </View>
      )}

      <ThemedText style={styles.tip} maxFontSizeMultiplier={1.5}>{displayTip}</ThemedText>

      {weather && (
        <View style={styles.conditionsRow}>
          <View style={styles.conditionStat}>
            <Thermometer color={colors.textSecondary} size={14} />
            <ThemedText style={styles.conditionValue}>{formatTemperature(weather.temperatureF)}</ThemedText>
          </View>
          <View style={styles.conditionStat}>
            <Wind color={colors.textSecondary} size={14} />
            <ThemedText style={styles.conditionValue}>{Math.round(weather.windSpeedMph)} mph</ThemedText>
          </View>
          <View style={styles.conditionStat}>
            <Cloud color={colors.textSecondary} size={14} />
            <ThemedText style={styles.conditionValue}>{weather.cloudCoverPercent}%</ThemedText>
          </View>
          {weather.pressureTrend && (
            <View style={styles.conditionStat}>
              <ThemedText style={styles.pressureTrend}>
                {weather.pressureTrend === 'falling' ? '↓' : weather.pressureTrend === 'rising' ? '↑' : '→'}{' '}
                pressure
              </ThemedText>
            </View>
          )}
        </View>
      )}

      {bestTime.tideNote && (
        <View style={styles.tideRow}>
          <Waves color={colors.accent} size={14} />
          <ThemedText style={styles.tideText}>{bestTime.tideNote}</ThemedText>
        </View>
      )}

      {bestTime.factors.length > 0 && (
        <View style={styles.factorsRow}>
          {bestTime.factors.slice(0, 4).map((factor) => (
            <FactorChip key={factor.name} {...factor} styles={styles} colors={colors} />
          ))}
        </View>
      )}

      {bestTime.communityCatchTimes && bestTime.communityCatchTimes.length > 0 && (
        <View style={styles.communityBlock}>
          <ThemedText style={styles.communityTitle}>Popular catch times nearby</ThemedText>
          <View style={styles.communityChips}>
            {bestTime.communityCatchTimes.map((slot) => (
              <View key={slot.hour} style={styles.communityChip}>
                <Clock color={colors.accent} size={11} />
                <ThemedText style={styles.communityChipText}>
                  {slot.label} ({slot.catchCount})
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      )}

      {bestTime.personalCatchTimes && bestTime.personalCatchTimes.length > 0 && (
        <View style={styles.communityBlock}>
          <ThemedText style={styles.personalTitle}>Your best hours nearby</ThemedText>
          <View style={styles.communityChips}>
            {bestTime.personalCatchTimes.map((slot) => (
              <View key={`personal-${slot.hour}`} style={styles.personalChip}>
                <Clock color={colors.success} size={11} />
                <ThemedText style={styles.personalChipText}>
                  {slot.label} ({slot.catchCount})
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      )}

      {bestTime.dailyCurve && bestTime.dailyCurve.points.length > 0 && (
        <View style={styles.hourlyBlock}>
          <ThemedText style={styles.hourlyTitle}>Best Times Today</ThemedText>
          {bestTime.forecastSubtitle && (
            <ThemedText style={styles.hourlySubtitle}>{bestTime.forecastSubtitle}</ThemedText>
          )}
          <BiteTimeChart
            curve={bestTime.dailyCurve}
            selectedIndex={selectedHourIndex}
            onSelectHour={setSelectedHourIndex}
          />
        </View>
      )}

      {bestTime.speciesBestTimes && bestTime.speciesBestTimes.length > 0 && (
        <View style={styles.speciesBlock}>
          <ThemedText style={styles.hourlyTitle}>Best Fish by Time</ThemedText>
          {bestTime.speciesBestTimes.map((species) => (
            <View
              key={species.id}
              style={styles.speciesRow}
              accessibilityLabel={`${species.name}, best times ${species.windows.join(' and ')}`}
            >
              <View
                style={[
                  styles.speciesRatingDot,
                  { backgroundColor: getActivityColor(species.rating) },
                ]}
              />
              <ThemedText style={styles.speciesName} numberOfLines={1}>
                {species.name}
              </ThemedText>
              <View style={styles.speciesWindows}>
                {species.windows.map((window, index) => (
                  <View key={`${species.id}-${index}`} style={styles.speciesWindowChip}>
                    <ThemedText style={styles.speciesWindowPeriod}>
                      {species.periods[index]}
                    </ThemedText>
                    <ThemedText style={styles.speciesWindowTime}>{window}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {bestTime.communityLures && bestTime.communityLures.length > 0 ? (
        <View style={styles.luresRow}>
          <ThemedText style={styles.luresLabel}>Anglers here used: </ThemedText>
          {bestTime.communityLures.map((lure) => (
            <View key={lure} style={[styles.lureChip, styles.communityLureChip]}>
              <ThemedText style={[styles.lureChipText, styles.communityLureChipText]}>{lure}</ThemedText>
            </View>
          ))}
        </View>
      ) : bestTime.recommendedLures.length > 0 ? (
        <View style={styles.luresRow}>
          <ThemedText style={styles.luresLabel}>Suggested: </ThemedText>
          {bestTime.recommendedLures.map((lure) => (
            <View key={lure} style={styles.lureChip}>
              <ThemedText style={styles.lureChipText}>{lure}</ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function getActivityLabelForRating(rating: number): string {
  const labels: Record<number, string> = {
    1: 'Slow',
    2: 'Fair',
    3: 'Good',
    4: 'Hot',
    5: 'Excellent',
  };
  return labels[rating] ?? 'Good';
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
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
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    ratingBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.cardLight,
    },
    ratingBadgeText: {
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.bold,
      letterSpacing: 0.5,
    },
    period: {
      color: colors.accent,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.bold,
      flex: 1,
    },
    activityBarTrack: {
      flexDirection: 'row',
      gap: 3,
    },
    activityBarSegment: {
      flex: 1,
      height: 4,
      borderRadius: 2,
    },
    timelineBlock: {
      gap: Spacing.xs,
    },
    timelineLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    timelineLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    timelineLabel: {
      fontSize: FontSizes.xs,
      color: colors.textMuted,
    },
    timelineTrack: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 3,
      position: 'relative',
      overflow: 'visible',
    },
    timelineFill: {
      height: '100%',
      backgroundColor: colors.accentDark,
      borderRadius: 3,
      opacity: 0.4,
    },
    timelineMarker: {
      position: 'absolute',
      top: -3,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.accent,
      marginLeft: -6,
      borderWidth: 2,
      borderColor: colors.card,
    },
    nextWindowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    nextWindowText: {
      fontSize: FontSizes.sm,
      color: colors.accent,
      fontWeight: FontWeights.medium,
    },
    tip: {
      color: colors.textSecondary,
      fontSize: FontSizes.md,
      lineHeight: 22,
    },
    conditionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
      paddingTop: Spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    conditionStat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    conditionValue: {
      color: colors.text,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
    },
    pressureTrend: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    tideRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.xs,
      backgroundColor: colors.cardLight,
      padding: Spacing.sm,
      borderRadius: BorderRadius.md,
    },
    tideText: {
      flex: 1,
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    factorsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    factorChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.cardLight,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.md,
      maxWidth: '48%',
    },
    factorImpact: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.bold,
    },
    factorTextBlock: {
      flex: 1,
    },
    factorName: {
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.semibold,
      color: colors.text,
    },
    factorDetail: {
      fontSize: 10,
      color: colors.textMuted,
    },
    communityBlock: {
      gap: Spacing.xs,
    },
    communityTitle: {
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    communityChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    communityChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.accentDark,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.full,
    },
    communityChipText: {
      fontSize: FontSizes.xs,
      color: colors.accent,
      fontWeight: FontWeights.medium,
    },
    personalTitle: {
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.semibold,
      color: colors.success,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    personalChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.successSurface,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.full,
    },
    personalChipText: {
      fontSize: FontSizes.xs,
      color: colors.success,
      fontWeight: FontWeights.medium,
    },
    hourlyBlock: {
      gap: Spacing.xs,
    },
    hourlyTitle: {
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    hourlySubtitle: {
      fontSize: FontSizes.xs,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    speciesBlock: {
      gap: Spacing.xs,
      paddingTop: Spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    speciesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    speciesRatingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    speciesName: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      color: colors.text,
      flex: 1,
    },
    speciesWindows: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: Spacing.xs,
      flexShrink: 1,
    },
    speciesWindowChip: {
      backgroundColor: colors.cardLight,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
      borderRadius: BorderRadius.md,
      alignItems: 'center',
    },
    speciesWindowPeriod: {
      fontSize: 9,
      fontWeight: FontWeights.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    speciesWindowTime: {
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.medium,
      color: colors.textSecondary,
    },
    luresRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    luresLabel: {
      fontSize: FontSizes.sm,
      color: colors.textMuted,
      fontWeight: FontWeights.medium,
    },
    lureChip: {
      backgroundColor: colors.accentDark,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.full,
    },
    lureChipText: {
      fontSize: FontSizes.xs,
      color: colors.accent,
      fontWeight: FontWeights.medium,
    },
    communityLureChip: {
      backgroundColor: colors.communityMuted,
      borderWidth: 1,
      borderColor: colors.community,
    },
    communityLureChipText: {
      color: colors.community,
      fontWeight: FontWeights.semibold,
    },
  });
}
