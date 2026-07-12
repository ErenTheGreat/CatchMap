import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  ChevronRight,
  CircleCheck,
  Clock,
  Download,
  Fish,
  Info,
  Trash2,
  Trophy,
} from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import {
  RecommendedSpecies,
  getMonthName,
  getCurrentMonth,
} from '@/utils/recommendations';
import type { BestTimeNowResult } from '@/utils/bestTimeNow';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import FishingNowCard from '@/components/map/FishingNowCard';
import TripPlannerCard from '@/components/map/TripPlannerCard';
import PersonalInsightsCard from '@/components/map/PersonalInsightsCard';
import PersonalBiteFingerprintCard from '@/components/insights/PersonalBiteFingerprintCard';
import type { CatchInsights } from '@/lib/types/catchInsights';
import type { PersonalBiteFingerprint } from '@/lib/types/personalBite';
import { isPersonalBiteEnabled } from '@/constants/features';
import { useProFeature } from '@/hooks/useProFeature';
import ProUpsellCard from '@/components/pro/ProUpsellCard';
import { useOfflineMap } from '@/hooks/useOfflineMap';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { ThemedText } from '@/components/ui';

type OfflineMapHandle = ReturnType<typeof useOfflineMap>;

interface MapDashboardContentProps {
  bestTime: BestTimeNowResult;
  weather?: WeatherSnapshot | null;
  recommendations: RecommendedSpecies[];
  offlineMap: OfflineMapHandle;
  insights?: CatchInsights;
  fingerprint?: PersonalBiteFingerprint;
  onViewInsights?: () => void;
  onUseRecommendation: (rec: RecommendedSpecies) => void;
}

export default function MapDashboardContent({
  bestTime,
  weather,
  recommendations,
  offlineMap,
  insights,
  fingerprint,
  onViewInsights,
  onUseRecommendation,
}: MapDashboardContentProps) {
  const { enabled: tripPlannerEnabled } = useProFeature('trip_planner');
  const { enabled: offlineMapsEnabled } = useProFeature('offline_maps');
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [selectedRecommendation, setSelectedRecommendation] =
    useState<RecommendedSpecies | null>(null);

  return (
    <View style={styles.container}>
      {isPersonalBiteEnabled() && fingerprint ? (
        <PersonalBiteFingerprintCard fingerprint={fingerprint} compact />
      ) : null}

      {insights ? (
        <PersonalInsightsCard insights={insights} onViewAll={onViewInsights} />
      ) : null}

      {offlineMap.state !== 'unavailable' ? (
        offlineMapsEnabled ? (
        <View style={styles.offlineRow}>
          {offlineMap.state === 'idle' && (
            <TouchableOpacity style={styles.offlineButton} onPress={offlineMap.download}>
              <Download color={colors.accent} size={16} />
              <ThemedText style={styles.offlineButtonText}>Save this area for offline use</ThemedText>
            </TouchableOpacity>
          )}
          {offlineMap.state === 'downloading' && (
            <View style={styles.offlineButton}>
              <ActivityIndicator color={colors.accent} size="small" />
              <ThemedText style={styles.offlineButtonText}>
                Downloading offline map… {offlineMap.percentage}%
              </ThemedText>
            </View>
          )}
          {offlineMap.state === 'complete' && (
            <View style={styles.offlineButton}>
              <CircleCheck color={colors.success} size={16} />
              <ThemedText style={styles.offlineButtonText}>Offline map saved</ThemedText>
              <TouchableOpacity
                onPress={offlineMap.remove}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Trash2 color={colors.textMuted} size={16} />
              </TouchableOpacity>
            </View>
          )}
          {offlineMap.state === 'error' && (
            <TouchableOpacity style={styles.offlineButton} onPress={offlineMap.download}>
              <Info color={colors.error} size={16} />
              <ThemedText style={styles.offlineButtonText}>Download failed — tap to retry</ThemedText>
            </TouchableOpacity>
          )}
        </View>
        ) : (
          <ProUpsellCard
            compact
            title="Offline maps"
            description="Download map tiles for remote fishing — available in a future app update."
          />
        )
      ) : null}

      {tripPlannerEnabled && bestTime.hourlyForecast.length > 0 ? (
        <TripPlannerCard hourlyForecast={bestTime.hourlyForecast} />
      ) : !tripPlannerEnabled ? (
        <ProUpsellCard
          compact
          title="Trip planner"
          description="See your best bite windows and add trips to your calendar."
        />
      ) : null}

      <View style={styles.sectionHeader}>
        <Clock color={colors.accent} size={18} />
        <ThemedText style={styles.sectionTitle}>Fishing Now</ThemedText>
      </View>
      <FishingNowCard bestTime={bestTime} weather={weather} />

      <View style={styles.sectionHeader}>
        <Fish color={colors.accent} size={18} />
        <ThemedText style={styles.sectionTitle}>Fish to Catch in {getMonthName(getCurrentMonth())}</ThemedText>
      </View>

      {recommendations.length > 0 && (
        <View style={styles.list}>
          {recommendations.map((rec) => (
            <TouchableOpacity
              key={rec.id}
              style={[styles.recCard, rec.isPeak && styles.peakCard]}
              onPress={() =>
                setSelectedRecommendation(
                  selectedRecommendation?.id === rec.id ? null : rec
                )
              }
              activeOpacity={0.7}
            >
              <View style={styles.recHeader}>
                <View style={styles.recIcon}>
                  <Fish color={colors.accent} size={18} />
                </View>
                <View style={styles.recInfo}>
                  <ThemedText style={styles.recName}>{rec.name}</ThemedText>
                  <ThemedText style={styles.recHabitat}>{rec.habitat}</ThemedText>
                </View>
                {rec.isPeak && (
                  <View style={styles.peakBadge}>
                    <Trophy color={colors.accentForeground} size={12} />
                    <ThemedText style={styles.peakBadgeText}>PEAK</ThemedText>
                  </View>
                )}
                <ChevronRight
                  color={
                    selectedRecommendation?.id === rec.id ? colors.accent : colors.textMuted
                  }
                  size={20}
                />
              </View>

              {selectedRecommendation?.id === rec.id && (
                <View style={styles.recExpanded}>
                  <ThemedText style={styles.recDescription}>{rec.tips}</ThemedText>
                  <View style={styles.recDetails}>
                    <View style={styles.recDetailItem}>
                      <ThemedText style={styles.recDetailLabel}>Avg Weight</ThemedText>
                      <ThemedText style={styles.recDetailValue}>{rec.averageWeight}</ThemedText>
                    </View>
                    <View style={styles.recDetailItem}>
                      <ThemedText style={styles.recDetailLabel}>Best Lure</ThemedText>
                      <ThemedText style={styles.recDetailValue}>{rec.recommendedLure}</ThemedText>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.useRecButton}
                    onPress={() => onUseRecommendation(rec)}
                  >
                    <Fish color={colors.accentForeground} size={16} />
                    <ThemedText style={styles.useRecText}>Log This Fish</ThemedText>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.xl,
    },
    offlineRow: {
      marginBottom: Spacing.md,
    },
    offlineButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.sm,
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    offlineButtonText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.semibold,
    },
    list: {
      gap: Spacing.sm,
    },
    recCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    peakCard: {
      borderColor: colors.accent,
      backgroundColor: colors.cardLight,
    },
    recHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    recIcon: {
      backgroundColor: colors.accentDark,
      padding: Spacing.sm,
      borderRadius: BorderRadius.md,
    },
    recInfo: {
      flex: 1,
    },
    recName: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
    },
    recHabitat: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      marginTop: Spacing.xs,
    },
    peakBadge: {
      backgroundColor: colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.sm,
      gap: Spacing.xs,
    },
    peakBadgeText: {
      color: colors.accentForeground,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.bold,
    },
    recExpanded: {
      marginTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: Spacing.md,
    },
    recDescription: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      lineHeight: 20,
      marginBottom: Spacing.md,
    },
    recDetails: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    recDetailItem: {
      flex: 1,
    },
    recDetailLabel: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      textTransform: 'uppercase',
    },
    recDetailValue: {
      color: colors.text,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
      marginTop: Spacing.xs,
    },
    useRecButton: {
      backgroundColor: colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.md,
    },
    useRecText: {
      color: colors.accentForeground,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
    },
  });
}
