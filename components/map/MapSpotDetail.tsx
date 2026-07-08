import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Image,
  Pressable,
} from 'react-native';
import * as Linking from 'expo-linking';
import { Anchor, ChevronRight, Clock, Fish, Navigation, Star, Trophy, Waves } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import RegulationNoticeCard from '@/components/map/RegulationNoticeCard';
import { ErrorState, Skeleton } from '@/components/ui';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { NearbySpot, formatDistance, getWaterTypeIcon } from '@/utils/recommendations';
import { getSpotRegulationNotices } from '@/utils/fishingRegulations';
import type { SpotDetails, CatchTimeSlot } from '@/lib/types/spotDetails';
import type { PersonalSpeciesNear } from '@/lib/types/catchInsights';
import type { AvailableSpecies, SpeciesPrediction, SkyCondition, DataConfidence, SpeciesSource } from '@/lib/types/speciesPrediction';
import {
  formatSkyConditionLabel,
  getActivityRatingColor,
} from '@/lib/types/speciesPrediction';
import { spotLikelyNeedsGbifLookup } from '@/lib/species/spotGbifLookup';

function getProbabilityColor(probability: number): string {
  if (probability >= 70) return '#10B981';
  if (probability >= 40) return '#F59E0B';
  return '#94A3B8';
}

function getConfidenceLabel(confidence?: DataConfidence, source?: SpeciesSource): string | null {
  if (source === 'gbif') {
    return 'Documented nearby';
  }

  switch (confidence) {
    case 'high':
      return 'Curated spot data';
    case 'medium':
      return 'Regional estimate';
    case 'low':
      return 'Category estimate';
    default:
      return null;
  }
}

function speciesToFallbackPrediction(species: AvailableSpecies): SpeciesPrediction {
  return {
    ...species,
    activityRating: 'Moderate',
    score: 3,
    probability: 50,
    factors: [],
  };
}

interface MapSpotDetailProps {
  spot: NearbySpot;
  spotDetails?: SpotDetails | null;
  spotDetailsLoading?: boolean;
  spotDetailsError?: boolean;
  availableSpecies?: AvailableSpecies[];
  predictions?: SpeciesPrediction[];
  predictionsLoading?: boolean;
  predictionsError?: boolean;
  skyCondition?: SkyCondition | null;
  temperatureF?: number | null;
  contextSubtitle?: string | null;
  onLogFish?: (spot: NearbySpot) => void;
  onSpeciesPress?: (species: AvailableSpecies, prediction?: SpeciesPrediction) => void;
  personalCatchTimes?: CatchTimeSlot[];
  personalSpeciesNear?: PersonalSpeciesNear[];
  onRetryPredictions?: () => void;
  onRetryCatchTimes?: () => void;
}

export default function MapSpotDetail({
  spot,
  spotDetails,
  spotDetailsLoading = false,
  spotDetailsError = false,
  availableSpecies = [],
  predictions = [],
  predictionsLoading = false,
  predictionsError = false,
  skyCondition = null,
  temperatureF = null,
  contextSubtitle = null,
  onLogFish,
  onSpeciesPress,
  personalCatchTimes = [],
  personalSpeciesNear = [],
  onRetryPredictions,
  onRetryCatchTimes,
}: MapSpotDetailProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const bestCatchTimes = spotDetails?.bestCatchTimes ?? [];
  const displayItems = useMemo(() => {
    if (predictions.length > 0) return predictions;
    return availableSpecies.map(speciesToFallbackPrediction);
  }, [predictions, availableSpecies]);
  const usingSpeciesFallback = predictions.length === 0 && availableSpecies.length > 0;
  const speciesLookupSlow = useMemo(
    () => spotLikelyNeedsGbifLookup(spot.id),
    [spot.id]
  );

  const regulationNotices = useMemo(
    () => getSpotRegulationNotices(spot),
    [spot.id, spot.latitude, spot.longitude, spot.water_type]
  );

  const weatherSubtitle =
    contextSubtitle ??
    (skyCondition != null && temperatureF != null
      ? `${formatSkyConditionLabel(skyCondition)} · ${Math.round(temperatureF)}°F`
      : skyCondition != null
        ? formatSkyConditionLabel(skyCondition)
        : null);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Anchor color={colors.accent} size={20} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{spot.name}</Text>
          <View style={styles.meta}>
            <Waves color={colors.textMuted} size={12} />
            <Text style={styles.type}>{getWaterTypeIcon(spot.water_type)}</Text>
            <Text style={styles.distance}>{formatDistance(spot.distance)}</Text>
            <Star color={colors.warning} size={12} fill={colors.warning} />
            <Text style={styles.rating}>{spot.rating.toFixed(1)}</Text>
          </View>
        </View>
        {spot.isPeakSeason && (
          <View style={styles.peakBadge}>
            <Trophy color={colors.background} size={10} />
            <Text style={styles.peakText}>PEAK</Text>
          </View>
        )}
      </View>

      <Text style={styles.description}>{spot.description}</Text>

      {(spot.avgDepthFeet != null || spot.bestSeason) && (
        <View style={styles.facilities}>
          <Text style={styles.facilitiesTitle}>Conditions: </Text>
          <Text style={styles.facilitiesList}>
            {[
              spot.avgDepthFeet != null ? `Avg depth ${spot.avgDepthFeet} ft` : null,
              spot.bestSeason ? `Best in ${spot.bestSeason}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      )}

      {spot.underwaterStructure && spot.underwaterStructure.length > 0 && (
        <View style={styles.facilities}>
          <Text style={styles.facilitiesTitle}>Structure: </Text>
          <Text style={styles.facilitiesList}>{spot.underwaterStructure.join(', ')}</Text>
        </View>
      )}

      <RegulationNoticeCard notices={regulationNotices} />

      <View style={styles.fishSection}>
        <Text style={styles.fishTitle}>Potential Catches</Text>
        {weatherSubtitle ? (
          <Text style={styles.weatherSubtitle}>{weatherSubtitle}</Text>
        ) : null}
        {usingSpeciesFallback ? (
          <Text style={styles.fallbackHint}>
            Activity scores unavailable — showing documented species for this spot
          </Text>
        ) : null}

        {predictionsLoading ? (
          <View style={styles.loadingBlock}>
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={styles.loadingText}>
                {speciesLookupSlow
                  ? 'Looking up nearby species…'
                  : 'Loading species…'}
              </Text>
            </View>
            {speciesLookupSlow ? (
              <Text style={styles.loadingHint}>
                Checking regional fish records — this can take a few seconds the first time.
              </Text>
            ) : null}
            <View style={styles.speciesSkeletonList}>
              {[0, 1, 2, 3].map((index) => (
                <View key={index} style={styles.speciesSkeletonRow}>
                  <Skeleton width={36} height={36} borderRadius={BorderRadius.md} />
                  <View style={styles.speciesSkeletonText}>
                    <Skeleton width="55%" height={14} />
                    <Skeleton
                      width="80%"
                      height={10}
                      style={{ marginTop: Spacing.xs }}
                    />
                    <Skeleton
                      width="100%"
                      height={6}
                      borderRadius={BorderRadius.full}
                      style={{ marginTop: Spacing.xs }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {!predictionsLoading && displayItems.length > 0 ? (
          <View style={styles.predictionsList}>
            {displayItems.map((item) => {
              const probability = item.probability ?? 0;
              const activityRating = item.activityRating ?? 'Moderate';
              const barColor = getProbabilityColor(probability);
              const rowConfidenceLabel = getConfidenceLabel(item.dataConfidence, item.source);

              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    styles.predictionRow,
                    pressed && styles.predictionRowPressed,
                  ]}
                  onPress={() => onSpeciesPress?.(item, item)}
                >
                  <View style={styles.predictionIcon}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.speciesImage} />
                    ) : (
                      <Fish color={colors.accent} size={16} />
                    )}
                  </View>
                  <View style={styles.predictionTextBlock}>
                    <View style={styles.predictionNameRow}>
                      <Text style={styles.predictionName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.probabilityLabel, { color: barColor }]}>
                        {probability}%
                      </Text>
                    </View>
                    {rowConfidenceLabel ? (
                      <View style={styles.rowConfidenceChip}>
                        <Text style={styles.rowConfidenceText}>{rowConfidenceLabel}</Text>
                      </View>
                    ) : null}
                    {item.scientificName ? (
                      <Text style={styles.predictionMeta} numberOfLines={1}>
                        {item.scientificName}
                      </Text>
                    ) : null}
                    <View style={styles.probabilityBarTrack}>
                      <View
                        style={[
                          styles.probabilityBarFill,
                          { width: `${probability}%`, backgroundColor: barColor },
                        ]}
                      />
                    </View>
                    <Text style={styles.predictionMeta} numberOfLines={1}>
                      {item.feedingZone} · months {item.monthStart}–{item.monthEnd}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.activityBadge,
                      { borderColor: getActivityRatingColor(activityRating) },
                    ]}
                    accessibilityLabel={`Activity rating: ${activityRating}`}
                  >
                    <Text
                      style={[
                        styles.activityBadgeText,
                        { color: getActivityRatingColor(activityRating) },
                      ]}
                    >
                      {activityRating}
                    </Text>
                  </View>
                  {onSpeciesPress ? (
                    <ChevronRight color={colors.textMuted} size={16} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : !predictionsLoading ? (
          predictionsError ? (
            <ErrorState
              title="Could not load species"
              message="Species data is unavailable right now."
              onRetry={onRetryPredictions}
            />
          ) : (
            <Text style={styles.noFishText}>
              No species recorded for this location this month
            </Text>
          )
        ) : null}
      </View>

      <View style={styles.catchTimesSection}>
        <Text style={styles.fishTitle}>Best Catch Times:</Text>
        {spotDetailsLoading ? (
          <Text style={styles.noFishText}>Analyzing nearby catch activity…</Text>
        ) : bestCatchTimes.length > 0 ? (
          <View style={styles.catchTimesList}>
            {bestCatchTimes.map((slot) => (
              <View key={slot.hour} style={styles.catchTimeChip}>
                <Clock color={colors.accent} size={12} />
                <Text style={styles.catchTimeText}>
                  {slot.label} — {slot.catchCount} logged{' '}
                  {slot.catchCount === 1 ? 'catch' : 'catches'}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          spotDetailsError ? (
            <ErrorState
              title="Could not load catch times"
              message="Catch time data is unavailable right now."
              onRetry={onRetryCatchTimes}
            />
          ) : (
            <Text style={styles.noFishText}>
              No logged catch times yet near this spot
            </Text>
          )
        )}
      </View>

      {personalSpeciesNear.length > 0 && (
        <View style={styles.catchTimesSection}>
          <Text style={styles.fishTitle}>Your catches here:</Text>
          <View style={styles.catchTimesList}>
            {personalSpeciesNear.map((item) => (
              <View key={item.species} style={styles.personalCatchTimeChip}>
                <Fish color={colors.success} size={12} />
                <Text style={styles.personalCatchTimeText}>
                  {item.species} — {item.count} of your{' '}
                  {item.count === 1 ? 'catch' : 'catches'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {personalCatchTimes.length > 0 && (
        <View style={styles.catchTimesSection}>
          <Text style={styles.fishTitle}>Your catch times here:</Text>
          <View style={styles.catchTimesList}>
            {personalCatchTimes.map((slot) => (
              <View key={`personal-${slot.hour}`} style={styles.personalCatchTimeChip}>
                <Clock color={colors.success} size={12} />
                <Text style={styles.personalCatchTimeText}>
                  {slot.label} — {slot.catchCount} of your{' '}
                  {slot.catchCount === 1 ? 'catch' : 'catches'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.facilities}>
        <Text style={styles.facilitiesTitle}>Facilities: </Text>
        <Text style={styles.facilitiesList}>
          {spot.facilities.map((f) => f.replace('_', ' ')).join(', ') || 'None listed'}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.directionsButton}
          onPress={() => {
            const url = `https://www.google.com/maps/search/?api=1&query=${spot.latitude},${spot.longitude}`;
            if (Platform.OS === 'web') {
              window.open(url, '_blank');
            } else {
              Linking.openURL(url);
            }
          }}
        >
          <Navigation color={colors.background} size={14} />
          <Text style={styles.directionsText}>Directions</Text>
        </TouchableOpacity>

        {displayItems.length > 0 && onLogFish && (
          <TouchableOpacity style={styles.logButton} onPress={() => onLogFish(spot)}>
            <Fish color={colors.accent} size={14} />
            <Text style={styles.logText}>Log Fish</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  icon: {
    backgroundColor: colors.accentDark,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  info: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  type: {
    color: colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  distance: {
    color: colors.accent,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  rating: {
    color: colors.warning,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  peakBadge: {
    backgroundColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 2,
  },
  peakText: {
    color: colors.background,
    fontSize: 10,
    fontWeight: FontWeights.bold,
  },
  description: {
    color: colors.textSecondary,
    fontSize: FontSizes.sm,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  fishSection: {
    marginBottom: Spacing.sm,
  },
  catchTimesSection: {
    marginBottom: Spacing.sm,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  loadingBlock: {
    marginBottom: Spacing.sm,
  },
  loadingHint: {
    color: colors.textMuted,
    fontSize: FontSizes.xs,
    marginBottom: Spacing.sm,
  },
  speciesSkeletonList: {
    gap: Spacing.sm,
  },
  speciesSkeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  speciesSkeletonText: {
    flex: 1,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  weatherSubtitle: {
    color: colors.textMuted,
    fontSize: FontSizes.xs,
    marginBottom: Spacing.xs,
  },
  fallbackHint: {
    color: colors.textMuted,
    fontSize: FontSizes.xs,
    fontStyle: 'italic',
    marginBottom: Spacing.sm,
  },
  rowConfidenceChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentDark,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginTop: 2,
    marginBottom: 4,
  },
  rowConfidenceText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: FontWeights.medium,
  },
  predictionsList: {
    gap: Spacing.xs,
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: colors.cardLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  predictionRowPressed: {
    opacity: 0.85,
    borderColor: colors.accent,
  },
  predictionIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    backgroundColor: colors.accentDark,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  speciesImage: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
  },
  predictionName: {
    color: colors.text,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    flex: 1,
  },
  predictionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  probabilityLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
  },
  probabilityBarTrack: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: BorderRadius.full,
    marginTop: 4,
    marginBottom: 2,
    overflow: 'hidden',
  },
  probabilityBarFill: {
    height: 4,
    borderRadius: BorderRadius.full,
  },
  predictionTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  predictionMeta: {
    color: colors.textMuted,
    fontSize: FontSizes.xs,
    marginTop: 1,
  },
  activityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  activityBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
  },
  catchTimesList: {
    gap: Spacing.xs,
  },
  catchTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.cardLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catchTimeText: {
    color: colors.text,
    fontSize: FontSizes.sm,
  },
  personalCatchTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successSurface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: colors.success,
  },
  personalCatchTimeText: {
    color: colors.success,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  fishTitle: {
    color: colors.text,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    marginBottom: Spacing.xs,
  },
  fishList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  fishChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentDark,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  fishChipText: {
    color: colors.accent,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
  },
  noFishText: {
    color: colors.textMuted,
    fontSize: FontSizes.sm,
    fontStyle: 'italic',
  },
  facilities: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  facilitiesTitle: {
    color: colors.textMuted,
    fontSize: FontSizes.xs,
    textTransform: 'uppercase',
  },
  facilitiesList: {
    color: colors.text,
    fontSize: FontSizes.sm,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  directionsButton: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    flex: 1,
  },
  directionsText: {
    color: colors.background,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  logButton: {
    backgroundColor: colors.cardLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    flex: 1,
  },
  logText: {
    color: colors.accent,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  });
}
