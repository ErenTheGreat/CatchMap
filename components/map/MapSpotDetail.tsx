import React, { useMemo, memo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Pressable,
} from 'react-native';
import { openSpotInMaps } from '@/utils/openSpotInMaps';
import { hapticLight } from '@/utils/haptics';
import { Anchor, Bookmark, ChevronRight, Clock, Fish, Navigation, Star, Trophy, Waves } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import RegulationNoticeCard from '@/components/map/RegulationNoticeCard';
import BiteScoreBreakdown from '@/components/map/BiteScoreBreakdown';
import FishingNowCard from '@/components/map/FishingNowCard';
import TripPlannerCard from '@/components/map/TripPlannerCard';
import AiTripBriefCard from '@/components/pro/AiTripBriefCard';
import { useProFeature } from '@/hooks/useProFeature';
import CommunityCatchIntelCard from '@/components/map/CommunityCatchIntelCard';
import { ErrorState, Skeleton, OfflineBanner, ThemedText } from '@/components/ui';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { NearbySpot, formatDistance, getWaterTypeIcon } from '@/utils/recommendations';
import { getSpotRegulationNotices } from '@/utils/fishingRegulations';
import type { SpotDetails, CatchTimeSlot } from '@/lib/types/spotDetails';
import type { PersonalSpeciesNear } from '@/lib/types/catchInsights';
import { scoreSpotForDiscovery } from '@/utils/spotDiscoveryScore';
import type { CommunityCatchSummary } from '@/utils/communityCatchIntel';
import type { PersonalBiteFingerprint } from '@/lib/types/personalBite';
import SpotDnaCard from '@/components/map/SpotDnaCard';
import { buildSpotDnaProfile } from '@/utils/spotDna';
import type { CatchRecord } from '@/utils/storage';
import type { TidePrediction } from '@/lib/api/endpoints/tides';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import type { BestTimeNowResult } from '@/utils/bestTimeNow';
import type { AvailableSpecies, SpeciesPrediction, SkyCondition, DataConfidence, SpeciesSource } from '@/lib/types/speciesPrediction';
import {
  formatSkyConditionLabel,
  getActivityRatingColor,
} from '@/lib/types/speciesPrediction';
import { dedupeAvailableSpecies } from '@/lib/api/endpoints/speciesPrediction';
import { spotLikelyNeedsGbifLookup } from '@/lib/species/spotGbifLookup';

function getProbabilityColor(probability: number, colors: ThemeColors): string {
  if (probability >= 70) return colors.activityHigh;
  if (probability >= 40) return colors.activityMedium;
  return colors.activityLow;
}

function getConfidenceLabel(confidence?: DataConfidence, source?: SpeciesSource): string | null {
  if (source === 'gbif') {
    return 'Verified from GBIF';
  }
  if (source === 'gbif_discovered') {
    return 'Discovered in this region';
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
    score: 0,
    probability: 0,
    factors: [],
  };
}

interface MapSpotDetailProps {
  spot: NearbySpot;
  bestTime?: BestTimeNowResult | null;
  showFishingNowCard?: boolean;
  spotDetails?: SpotDetails | null;
  spotDetailsLoading?: boolean;
  spotDetailsError?: boolean;
  availableSpecies?: AvailableSpecies[];
  predictions?: SpeciesPrediction[];
  predictionsLoading?: boolean;
  predictionsUpdating?: boolean;
  predictionsError?: boolean;
  isOffline?: boolean;
  skyCondition?: SkyCondition | null;
  temperatureF?: number | null;
  contextSubtitle?: string | null;
  onLogFish?: (spot: NearbySpot) => void;
  onSpeciesPress?: (species: AvailableSpecies, prediction?: SpeciesPrediction) => void;
  personalCatchTimes?: CatchTimeSlot[];
  personalSpeciesNear?: PersonalSpeciesNear[];
  onRetryPredictions?: () => void;
  onRetryCatchTimes?: () => void;
  weather?: WeatherSnapshot | null;
  tides?: TidePrediction[] | null;
  isSaved?: boolean;
  onToggleSaved?: (spot: NearbySpot) => void;
  communityCatchSummary?: CommunityCatchSummary;
  communityCatchLoading?: boolean;
  communityCatchError?: boolean;
  onCommunityCatchRetry?: () => void;
  fingerprint?: PersonalBiteFingerprint;
  catches?: CatchRecord[];
}

export default memo(function MapSpotDetail({
  spot,
  bestTime = null,
  showFishingNowCard = false,
  spotDetails,
  spotDetailsLoading = false,
  spotDetailsError = false,
  availableSpecies = [],
  predictions = [],
  predictionsLoading = false,
  predictionsUpdating = false,
  predictionsError = false,
  isOffline = false,
  skyCondition = null,
  temperatureF = null,
  contextSubtitle = null,
  onLogFish,
  onSpeciesPress,
  personalCatchTimes = [],
  personalSpeciesNear = [],
  onRetryPredictions,
  onRetryCatchTimes,
  weather = null,
  tides = null,
  isSaved = false,
  onToggleSaved,
  communityCatchSummary,
  communityCatchLoading = false,
  communityCatchError = false,
  onCommunityCatchRetry,
  fingerprint,
  catches = [],
}: MapSpotDetailProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { enabled: tripPlannerEnabled } = useProFeature('trip_planner');
  const bestCatchTimes = spotDetails?.bestCatchTimes ?? [];
  const absoluteDiscoveryScore = useMemo(
    () =>
      scoreSpotForDiscovery(spot, {
        weather,
        tides,
      }),
    [spot, weather, tides]
  );
  const breakdownScore = absoluteDiscoveryScore;
  const displayItems = useMemo((): SpeciesPrediction[] => {
    const source: SpeciesPrediction[] =
      predictions.length > 0
        ? predictions
        : availableSpecies.length > 0
          ? availableSpecies.map(speciesToFallbackPrediction)
          : [];
    return dedupeAvailableSpecies(source) as SpeciesPrediction[];
  }, [predictions, availableSpecies]);
  const usingSpeciesFallback = predictions.length === 0 && availableSpecies.length > 0;
  const speciesLookupSlow = useMemo(
    () => spotLikelyNeedsGbifLookup(spot.id),
    [spot.id]
  );

  const regulationNotices = useMemo(
    () => getSpotRegulationNotices(spot),
    [spot]
  );

  const spotDna = useMemo(
    () =>
      buildSpotDnaProfile(
        spot,
        catches,
        communityCatchSummary ?? null,
        regulationNotices
      ),
    [spot, catches, communityCatchSummary, regulationNotices]
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
          <ThemedText style={styles.name}>{spot.name}</ThemedText>
          <View style={styles.meta}>
            <Waves color={colors.textMuted} size={12} />
            <ThemedText style={styles.type}>{getWaterTypeIcon(spot.water_type)}</ThemedText>
            <ThemedText style={styles.distance}>{formatDistance(spot.distance)}</ThemedText>
            <Star color={colors.warning} size={12} fill={colors.warning} />
            <ThemedText style={styles.rating}>{spot.rating.toFixed(1)}</ThemedText>
          </View>
        </View>
        {spot.isPeakSeason && (
          <View style={styles.peakBadge}>
            <Trophy color={colors.background} size={10} />
            <ThemedText style={styles.peakText}>PEAK</ThemedText>
          </View>
        )}
        {onToggleSaved ? (
          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => {
              hapticLight();
              onToggleSaved(spot);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? `Remove ${spot.name} from saved waters` : `Save ${spot.name}`}
          >
            <Bookmark
              color={isSaved ? colors.accent : colors.textMuted}
              size={20}
              fill={isSaved ? colors.accent : 'transparent'}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      <ThemedText style={styles.description}>{spot.description}</ThemedText>

      {(spot.avgDepthFeet != null || spot.bestSeason) && (
        <View style={styles.facilities}>
          <ThemedText style={styles.facilitiesTitle}>Conditions: </ThemedText>
          <ThemedText style={styles.facilitiesList}>
            {[
              spot.avgDepthFeet != null ? `Avg depth ${spot.avgDepthFeet} ft` : null,
              spot.bestSeason ? `Best in ${spot.bestSeason}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
        </View>
      )}

      {spot.underwaterStructure && spot.underwaterStructure.length > 0 && (
        <View style={styles.facilities}>
          <ThemedText style={styles.facilitiesTitle}>Structure: </ThemedText>
          <ThemedText style={styles.facilitiesList}>{spot.underwaterStructure.join(', ')}</ThemedText>
        </View>
      )}

      <RegulationNoticeCard notices={regulationNotices} />

      <SpotDnaCard profile={spotDna} />

      {showFishingNowCard && bestTime ? (
        <View style={styles.fishingNowSection}>
          <FishingNowCard bestTime={bestTime} weather={weather} />
        </View>
      ) : null}

      <CommunityCatchIntelCard
        summary={
          communityCatchSummary ?? {
            totalCatches: 0,
            speciesBreakdown: [],
            topLures: [],
            daysBack: 90,
          }
        }
        isLoading={communityCatchLoading}
        isError={communityCatchError}
        onRetry={onCommunityCatchRetry}
      />

      {breakdownScore ? (
        <BiteScoreBreakdown
          score={breakdownScore}
          spotName={spot.name}
          defaultExpanded
          contextLabel="Conditions at this spot"
        />
      ) : null}

      {tripPlannerEnabled && breakdownScore && (breakdownScore.hourlyForecast?.length ?? 0) > 0 ? (
        <TripPlannerCard
          hourlyForecast={breakdownScore.hourlyForecast ?? []}
          spotName={spot.name}
          latitude={spot.latitude}
          longitude={spot.longitude}
          fingerprint={fingerprint}
          weather={weather}
        />
      ) : null}

      <AiTripBriefCard spot={spot} weather={weather ?? undefined} />

      <View style={styles.fishSection}>
        <ThemedText style={styles.fishTitle}>Potential Catches</ThemedText>
        {isOffline && displayItems.length > 0 ? (
          <OfflineBanner
            compact
            title="Offline — showing cached species"
            message="Activity scores use the last saved weather when available."
          />
        ) : null}
        {weatherSubtitle ? (
          <ThemedText style={styles.weatherSubtitle}>{weatherSubtitle}</ThemedText>
        ) : null}
        {usingSpeciesFallback ? (
          <ThemedText style={styles.fallbackHint}>
            Activity scores unavailable — showing documented species only
          </ThemedText>
        ) : null}

        {predictionsUpdating && !predictionsLoading && displayItems.length > 0 ? (
          <ThemedText style={styles.updatingHint}>Updating species and activity scores…</ThemedText>
        ) : null}

        {predictionsLoading ? (
          <View style={styles.loadingBlock}>
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.accent} size="small" />
              <ThemedText style={styles.loadingText}>
                {isOffline
                  ? 'Loading cached species…'
                  : speciesLookupSlow
                    ? 'Looking up nearby species…'
                    : 'Loading species…'}
              </ThemedText>
            </View>
            {isOffline ? (
              <ThemedText style={styles.loadingHint}>
                {"If you've opened this spot before, saved species should appear shortly."}
              </ThemedText>
            ) : speciesLookupSlow ? (
              <ThemedText style={styles.loadingHint}>
                Checking regional fish records — this can take a few seconds the first time.
              </ThemedText>
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
              const hasActivityScore = !usingSpeciesFallback;
              const probability = hasActivityScore ? (item.probability ?? 0) : 0;
              const activityRating = item.activityRating ?? 'Moderate';
              const barColor = getProbabilityColor(probability, colors);
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
                      <ThemedText style={styles.predictionName} numberOfLines={1}>
                        {item.name}
                      </ThemedText>
                      {hasActivityScore ? (
                        <ThemedText style={[styles.probabilityLabel, { color: barColor }]}>
                          {probability}%
                        </ThemedText>
                      ) : null}
                    </View>
                    {rowConfidenceLabel ? (
                      <View style={styles.rowConfidenceChip}>
                        <ThemedText style={styles.rowConfidenceText}>{rowConfidenceLabel}</ThemedText>
                      </View>
                    ) : null}
                    {item.scientificName ? (
                      <ThemedText style={styles.predictionMeta} numberOfLines={1}>
                        {item.scientificName}
                      </ThemedText>
                    ) : null}
                    {hasActivityScore ? (
                      <View style={styles.probabilityBarTrack}>
                        <View
                          style={[
                            styles.probabilityBarFill,
                            { width: `${probability}%`, backgroundColor: barColor },
                          ]}
                        />
                      </View>
                    ) : null}
                    <ThemedText style={styles.predictionMeta} numberOfLines={1}>
                      {item.feedingZone} · months {item.monthStart}–{item.monthEnd}
                    </ThemedText>
                  </View>
                  {hasActivityScore ? (
                    <View
                      style={[
                        styles.activityBadge,
                        { borderColor: getActivityRatingColor(activityRating) },
                      ]}
                      accessibilityLabel={`Activity rating: ${activityRating}`}
                    >
                      <ThemedText
                        style={[
                          styles.activityBadgeText,
                          { color: getActivityRatingColor(activityRating) },
                        ]}
                      >
                        {activityRating}
                      </ThemedText>
                    </View>
                  ) : null}
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
              message={
                isOffline
                  ? 'No saved species data for this spot yet. Connect to load documented species.'
                  : 'Species data is unavailable right now.'
              }
              onRetry={isOffline ? undefined : onRetryPredictions}
            />
          ) : (
            <View>
              <ThemedText style={styles.noFishText}>
                {isOffline
                  ? 'No saved species for this spot yet. Connect to load documented species.'
                  : 'No documented species here yet. Log a catch to help build the record.'}
              </ThemedText>
              {onLogFish && !isOffline ? (
                <TouchableOpacity
                  style={styles.logFishLink}
                  onPress={() => onLogFish(spot)}
                  accessibilityRole="button"
                  accessibilityLabel="Log a catch at this spot"
                >
                  <ThemedText style={styles.logFishLinkText}>Log a catch</ThemedText>
                </TouchableOpacity>
              ) : null}
            </View>
          )
        ) : null}
      </View>

      <View style={styles.catchTimesSection}>
        <ThemedText style={styles.fishTitle}>Best Catch Times:</ThemedText>
        {spotDetailsLoading ? (
          <View style={styles.catchTimesSkeletonList}>
            {[0, 1, 2].map((index) => (
              <Skeleton
                key={index}
                width="100%"
                height={28}
                borderRadius={BorderRadius.full}
              />
            ))}
          </View>
        ) : bestCatchTimes.length > 0 ? (
          <View style={styles.catchTimesList}>
            {bestCatchTimes.map((slot) => (
              <View key={slot.hour} style={styles.catchTimeChip}>
                <Clock color={colors.accent} size={12} />
                <ThemedText style={styles.catchTimeText}>
                  {slot.label} — {slot.catchCount} logged{' '}
                  {slot.catchCount === 1 ? 'catch' : 'catches'}
                </ThemedText>
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
            <ThemedText style={styles.noFishText}>
              No logged catch times yet near this spot
            </ThemedText>
          )
        )}
      </View>

      {personalSpeciesNear.length > 0 && (
        <View style={styles.catchTimesSection}>
          <ThemedText style={styles.fishTitle}>Your catches here:</ThemedText>
          <View style={styles.catchTimesList}>
            {personalSpeciesNear.map((item) => (
              <View key={item.species} style={styles.personalCatchTimeChip}>
                <Fish color={colors.success} size={12} />
                <ThemedText style={styles.personalCatchTimeText}>
                  {item.species} — {item.count} of your{' '}
                  {item.count === 1 ? 'catch' : 'catches'}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      )}

      {personalCatchTimes.length > 0 && (
        <View style={styles.catchTimesSection}>
          <ThemedText style={styles.fishTitle}>Your catch times here:</ThemedText>
          <View style={styles.catchTimesList}>
            {personalCatchTimes.map((slot) => (
              <View key={`personal-${slot.hour}`} style={styles.personalCatchTimeChip}>
                <Clock color={colors.success} size={12} />
                <ThemedText style={styles.personalCatchTimeText}>
                  {slot.label} — {slot.catchCount} of your{' '}
                  {slot.catchCount === 1 ? 'catch' : 'catches'}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.facilities}>
        <ThemedText style={styles.facilitiesTitle}>Facilities: </ThemedText>
        <ThemedText style={styles.facilitiesList}>
          {spot.facilities.map((f) => f.replace('_', ' ')).join(', ') || 'None listed'}
        </ThemedText>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.directionsButton}
          onPress={() =>
            void openSpotInMaps({
              latitude: spot.latitude,
              longitude: spot.longitude,
              name: spot.name,
            })
          }
          accessibilityRole="button"
          accessibilityLabel={`Navigate to ${spot.name}`}
        >
          <Navigation color={colors.background} size={14} />
          <ThemedText style={styles.directionsText}>Navigate</ThemedText>
        </TouchableOpacity>

        {displayItems.length > 0 && onLogFish && (
          <TouchableOpacity
            style={styles.logButton}
            onPress={() => onLogFish(spot)}
            accessibilityRole="button"
            accessibilityLabel={`Log a catch at ${spot.name}`}
          >
            <Fish color={colors.accent} size={14} />
            <ThemedText style={styles.logText}>Log Fish</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

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
  saveButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.xs,
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
  fishingNowSection: {
    marginBottom: Spacing.md,
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
  updatingHint: {
    color: colors.textMuted,
    fontSize: FontSizes.xs,
    marginBottom: Spacing.xs,
  },
  catchTimesSkeletonList: {
    gap: Spacing.xs,
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
  logFishLink: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
  },
  logFishLinkText: {
    color: colors.accent,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
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
