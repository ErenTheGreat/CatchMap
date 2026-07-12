import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Calendar, Clock, Fish, MapPin, Sparkles } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import type { CatchInsights } from '@/lib/types/catchInsights';
import type { PersonalBiteFingerprint } from '@/lib/types/personalBite';
import { MIN_CATCHES_FOR_INSIGHTS } from '@/utils/catchInsights';
import PersonalBiteFingerprintCard from '@/components/insights/PersonalBiteFingerprintCard';
import { isPersonalBiteEnabled } from '@/constants/features';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';

interface CatchInsightsPanelProps {
  insights: CatchInsights;
  fingerprint?: PersonalBiteFingerprint;
  onViewSpotOnMap?: (lat: number, lon: number) => void;
}

export default function CatchInsightsPanel({
  insights,
  fingerprint,
  onViewSpotOnMap,
}: CatchInsightsPanelProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (!insights.hasEnoughData) {
    const logged = insights.totalCatches;
    return (
      <View style={styles.unlockCard}>
        <Sparkles color={colors.textMuted} size={20} />
        <Text style={styles.unlockTitle}>Unlock pattern insights</Text>
        <Text style={styles.unlockText}>
          Log {insights.catchesUntilUnlock} more{' '}
          {insights.catchesUntilUnlock === 1 ? 'catch' : 'catches'} to see your best hours, top
          species, and productive spots.
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, (logged / MIN_CATCHES_FOR_INSIGHTS) * 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>
          {logged} of {MIN_CATCHES_FOR_INSIGHTS} catches logged
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isPersonalBiteEnabled() && fingerprint ? (
        <PersonalBiteFingerprintCard fingerprint={fingerprint} />
      ) : null}

      <Text style={styles.sectionTitle}>Your Patterns</Text>
      <Text style={styles.sectionSubtitle}>
        Based on {insights.totalCatches} logged {insights.totalCatches === 1 ? 'catch' : 'catches'}
      </Text>

      {insights.bestHours.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Best fishing hours</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {insights.bestHours.map((slot) => (
                <View key={slot.hour} style={styles.hourChip}>
                  <Clock color={colors.accent} size={12} />
                  <Text style={styles.hourChipText}>
                    {slot.label} ({slot.catchCount})
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {insights.bestMonths.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Most active months</Text>
          <View style={styles.chipRow}>
            {insights.bestMonths.map((item) => (
              <View key={item.month} style={styles.monthChip}>
                <Calendar color={colors.warning} size={12} />
                <Text style={styles.monthChipText}>
                  {item.label} ({item.count})
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {insights.topSpecies.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Top species</Text>
          {insights.topSpecies.map((item) => (
            <View key={item.species} style={styles.rankRow}>
              <Fish color={colors.accent} size={14} />
              <Text style={styles.rankLabel}>{item.species}</Text>
              <Text style={styles.rankValue}>
                {item.count} · {item.pct}%
              </Text>
            </View>
          ))}
        </View>
      )}

      {insights.hasGeoData && insights.topSpots.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Most productive spots</Text>
          {insights.topSpots.map((spot) => (
            <Pressable
              key={`${spot.lat}-${spot.lon}`}
              style={styles.rankRow}
              onPress={() => onViewSpotOnMap?.(spot.lat, spot.lon)}
              disabled={!onViewSpotOnMap}
              accessibilityRole={onViewSpotOnMap ? 'button' : undefined}
              accessibilityLabel={`View ${spot.count} catches on map at ${spot.label}`}
            >
              <MapPin color={colors.success} size={14} />
              <Text style={[styles.rankLabel, onViewSpotOnMap && styles.rankLink]}>
                {spot.label}
              </Text>
              <Text style={styles.rankValue}>
                {spot.count} {spot.count === 1 ? 'catch' : 'catches'}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.hintBlock}>
          <Text style={styles.hintText}>
            Log catches from the map to track your most productive spots.
          </Text>
        </View>
      )}

      {insights.topLures.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Go-to lures</Text>
          {insights.topLures.map((item) => (
            <View key={item.lure} style={styles.rankRow}>
              <Text style={styles.rankLabel}>{item.lure}</Text>
              <Text style={styles.rankValue}>{item.count}</Text>
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
      marginBottom: Spacing.lg,
    },
    sectionTitle: {
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.semibold,
      color: colors.text,
    },
    sectionSubtitle: {
      fontSize: FontSizes.sm,
      color: colors.textMuted,
      marginBottom: Spacing.md,
      marginTop: 2,
    },
    block: {
      marginBottom: Spacing.md,
      gap: Spacing.xs,
    },
    blockTitle: {
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: Spacing.xs,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    hourChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.accentDark,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.full,
    },
    hourChipText: {
      fontSize: FontSizes.xs,
      color: colors.accent,
      fontWeight: FontWeights.medium,
    },
    monthChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.warningSurface,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: colors.toastWarning,
    },
    monthChipText: {
      fontSize: FontSizes.xs,
      color: colors.text,
      fontWeight: FontWeights.medium,
    },
    rankRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: 4,
    },
    rankLabel: {
      flex: 1,
      fontSize: FontSizes.sm,
      color: colors.text,
    },
    rankLink: {
      color: colors.accent,
      textDecorationLine: 'underline',
    },
    rankValue: {
      fontSize: FontSizes.sm,
      color: colors.textMuted,
      fontWeight: FontWeights.medium,
    },
    hintBlock: {
      backgroundColor: colors.cardLight,
      padding: Spacing.sm,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.md,
    },
    hintText: {
      fontSize: FontSizes.sm,
      color: colors.textMuted,
      fontStyle: 'italic',
    },
    unlockCard: {
      alignItems: 'center',
      backgroundColor: colors.cardLight,
      padding: Spacing.lg,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.lg,
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
