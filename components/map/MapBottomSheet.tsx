import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Pressable,
  Linking,
  ScrollView,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { ChevronLeft, Database, Fish, MapPin, RefreshCw } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { BOTTOM_SHEET_SNAP_POINTS } from '@/components/map/mapSheetConstants';
import { MAP_SIDE_PANEL_WIDTH } from '@/constants/layout';
import { Skeleton, OfflineBanner } from '@/components/ui';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import MapSpotDetail from '@/components/map/MapSpotDetail';
import MapDashboardContent from '@/components/map/MapDashboardContent';
import AreaRegulationsBanner from '@/components/map/AreaRegulationsBanner';
import DiscoveryDashboard, {
  type DiscoveryDashboardStatus,
} from '@/components/map/DiscoveryDashboard';
import type { LocalSpecies } from '@/lib/types/fishingEngine';
import type { AvailableSpecies, SpeciesPrediction, SkyCondition } from '@/lib/types/speciesPrediction';
import type { SpotDetails, CatchTimeSlot } from '@/lib/types/spotDetails';
import type { CategorizedSpotsResponse } from '@/lib/types/categorizedSpots';
import type { CoordinateSource } from '@/lib/types/mapCoordinates';
import type { NearbySpot, RecommendedSpecies } from '@/utils/recommendations';
import type { BestTimeNowResult } from '@/utils/bestTimeNow';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import type { CatchInsights, PersonalSpeciesNear } from '@/lib/types/catchInsights';
import type { RegulationNotice } from '@/lib/types/fishingRegulations';
import { useOfflineMap } from '@/hooks/useOfflineMap';

type OfflineMapHandle = ReturnType<typeof useOfflineMap>;

export interface MapBottomSheetHandle {
  snapToIndex: (index: number) => void;
}

export interface MapBottomSheetProps {
  species: LocalSpecies[];
  speciesLoading: boolean;
  speciesFetching: boolean;
  isOffline: boolean;
  permissionDenied: boolean;
  radiusMeters: number;
  coordinateSource?: CoordinateSource;
  locationLabel?: string;
  onRetrySpecies?: () => void;
  selectedSpot: NearbySpot | null;
  spotDetails?: SpotDetails | null;
  spotDetailsLoading?: boolean;
  spotDetailsError?: boolean;
  speciesPredictions?: SpeciesPrediction[];
  availableSpecies?: AvailableSpecies[];
  speciesPredictionsLoading?: boolean;
  speciesPredictionsUpdating?: boolean;
  speciesPredictionsError?: boolean;
  speciesSkyCondition?: SkyCondition | null;
  speciesTemperatureF?: number | null;
  speciesContextSubtitle?: string | null;
  onSheetIndexChange?: (index: number) => void;
  bestTime: BestTimeNowResult;
  weather?: WeatherSnapshot | null;
  recommendations: RecommendedSpecies[];
  categorizedSpots: CategorizedSpotsResponse;
  discoveryStatus: DiscoveryDashboardStatus;
  usingCachedDiscovery?: boolean;
  offlineMap: OfflineMapHandle;
  onSpotPress: (spot: NearbySpot) => void;
  /** Highlights the matching card in the discovery carousel. */
  selectedSpotId?: string | null;
  /** Clears the selected spot and returns to the Waters in View list. */
  onClearSelection?: () => void;
  onUseRecommendation: (rec: RecommendedSpecies) => void;
  onLogSpotFish: (spot: NearbySpot) => void;
  onSpeciesPress?: (species: AvailableSpecies, prediction?: SpeciesPrediction) => void;
  personalCatchTimes?: CatchTimeSlot[];
  personalSpeciesNear?: PersonalSpeciesNear[];
  onRetryPredictions?: () => void;
  onRetryCatchTimes?: () => void;
  insights?: CatchInsights;
  onViewInsights?: () => void;
  areaRegulationNotices?: RegulationNotice[];
  /** Side panel mode for tablet/web — replaces the bottom sheet. */
  panelMode?: boolean;
  panelWidth?: number;
}

const MapBottomSheet = forwardRef<MapBottomSheetHandle, MapBottomSheetProps>(
  (
    {
      species,
      speciesLoading,
      speciesFetching,
      isOffline,
      permissionDenied,
      radiusMeters,
      coordinateSource = 'gps',
      locationLabel,
      onRetrySpecies,
      selectedSpot,
      spotDetails,
      spotDetailsLoading = false,
      spotDetailsError = false,
      speciesPredictions = [],
      availableSpecies = [],
      speciesPredictionsLoading = false,
      speciesPredictionsUpdating = false,
      speciesPredictionsError = false,
      speciesSkyCondition = null,
      speciesTemperatureF = null,
      speciesContextSubtitle = null,
      onSheetIndexChange,
      bestTime,
      weather,
      recommendations,
      categorizedSpots,
      discoveryStatus,
      usingCachedDiscovery = false,
      offlineMap,
      onSpotPress,
      onClearSelection,
      selectedSpotId = null,
      onUseRecommendation,
      onLogSpotFish,
      onSpeciesPress,
      personalCatchTimes = [],
      personalSpeciesNear = [],
      onRetryPredictions,
      onRetryCatchTimes,
      insights,
      onViewInsights,
      areaRegulationNotices = [],
      panelMode = false,
      panelWidth = MAP_SIDE_PANEL_WIDTH,
    },
    ref
  ) => {
    const { colors } = useTheme();
    const styles = useThemedStyles(createStyles);
    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => [...BOTTOM_SHEET_SNAP_POINTS], []);
    const [sheetIndex, setSheetIndex] = useState(0);

    useImperativeHandle(
      ref,
      () => ({
        snapToIndex(index: number) {
          if (!panelMode) {
            bottomSheetRef.current?.snapToIndex(index);
          }
        },
      }),
      [panelMode]
    );

    const discoverySummary = useMemo(() => {
      if (discoveryStatus === 'zoom-out') {
        return 'Zoom in to explore waters';
      }
      if (discoveryStatus === 'waiting-for-map' || discoveryStatus === 'loading') {
        return 'Loading waters in view…';
      }
      const totalSpots = categorizedSpots.reduce((sum, group) => sum + group.spots.length, 0);
      if (totalSpots === 0) {
        return 'No waters in this map view';
      }
      return `${totalSpots} waters in view · Swipe up to browse`;
    }, [categorizedSpots, discoveryStatus]);

    const subtitle = useMemo(() => {
      if (coordinateSource === 'search' && locationLabel) {
        return `Exploring: ${locationLabel}`;
      }
      return 'Exploring this map area';
    }, [coordinateSource, locationLabel]);

    const handleSheetChange = useCallback(
      (index: number) => {
        setSheetIndex(index);
        onSheetIndexChange?.(index);
      },
      [onSheetIndexChange]
    );

    const showSpotDetail = panelMode
      ? selectedSpot != null
      : selectedSpot != null && sheetIndex >= 1;
    const showDiscovery = panelMode
      ? selectedSpot == null
      : selectedSpot == null && sheetIndex >= 1;
    const showExtras = panelMode ? true : sheetIndex >= 2;
    const showCategoryPreview =
      !panelMode &&
      selectedSpot == null &&
      sheetIndex === 0 &&
      discoveryStatus === 'ready' &&
      categorizedSpots.length > 0;

    const sheetBody = (
      <>
          {isOffline ? (
            <OfflineBanner
              compact={!selectedSpot && sheetIndex === 0}
              message={
                selectedSpot
                  ? 'Cached species and scores may be shown for this spot. Live lookups resume when you reconnect.'
                  : 'Showing saved data where available. New lookups will resume when you reconnect.'
              }
            />
          ) : null}

          <View style={styles.peekHeader}>
            <View style={styles.badgeRow}>
              <Database color={colors.brandAccent} size={14} />
              <Text style={styles.badgeText}>Live Database</Text>
              {speciesFetching && !speciesLoading && (
                <ActivityIndicator color={colors.textMuted} size="small" />
              )}
            </View>
            <Text style={styles.peekTitle}>
              {selectedSpot ? selectedSpot.name : discoverySummary}
            </Text>
            <Text style={styles.peekSubtitle}>
              {selectedSpot
                ? `${formatSpotSubtitle(selectedSpot)}${panelMode ? '' : ' · Swipe up for more'}`
                : subtitle}
            </Text>

            {!selectedSpot && !speciesLoading && species.length > 0 && (
              <View style={styles.peekRow}>
                {species.slice(0, 3).map((item) => (
                  <View key={item.id} style={styles.peekChip}>
                    <Fish color={colors.brandAccent} size={12} />
                    <Text style={styles.peekChipText} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {!selectedSpot && speciesLoading && (
              <View style={styles.loadingSpecies}>
                <ActivityIndicator color={colors.accent} size="small" />
                <Text style={styles.loadingSpeciesText}>Loading nearby species…</Text>
                <View style={styles.peekSkeletonRow}>
                  <Skeleton width={100} height={24} borderRadius={BorderRadius.full} />
                  <Skeleton width={120} height={24} borderRadius={BorderRadius.full} />
                </View>
              </View>
            )}

            {!selectedSpot && permissionDenied && (
              <View style={styles.notice}>
                <MapPin color={colors.textSecondary} size={14} />
                <Text style={styles.noticeText}>
                  Location off — showing default area
                </Text>
                <Pressable
                  style={styles.settingsButton}
                  onPress={() => Linking.openSettings()}
                  accessibilityRole="button"
                  accessibilityLabel="Open settings to enable location"
                >
                  <Text style={styles.settingsButtonText}>Open Settings</Text>
                </Pressable>
              </View>
            )}

            {!selectedSpot && isOffline && onRetrySpecies ? (
              <Pressable
                style={styles.retryButton}
                onPress={onRetrySpecies}
                accessibilityRole="button"
                accessibilityLabel="Retry loading species"
              >
                <RefreshCw color={colors.accentForeground} size={14} />
                <Text style={styles.retryText}>Retry when online</Text>
              </Pressable>
            ) : null}

            {!selectedSpot && !speciesLoading && species.length === 0 && !isOffline && (
              <View style={styles.emptySpecies}>
                <Fish color={colors.textMuted} size={20} />
                <Text style={styles.emptySpeciesText}>
                  No documented species in this area yet. Explore new waters to enrich the catalog.
                </Text>
              </View>
            )}

            {!selectedSpot && areaRegulationNotices.length > 0 && (
              <AreaRegulationsBanner notices={areaRegulationNotices} />
            )}

            {showCategoryPreview && (
              <View style={styles.peekRow}>
                {categorizedSpots.map((group) => (
                  <View key={group.category} style={styles.peekChip}>
                    <Text style={styles.peekChipText} numberOfLines={1}>
                      {group.category} · {group.spots.length}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {showSpotDetail && selectedSpot ? (
            <>
              {onClearSelection ? (
                <TouchableOpacity
                  style={styles.backRow}
                  onPress={onClearSelection}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <ChevronLeft color={colors.accent} size={18} />
                  <Text style={styles.backRowText}>Back to waters in view</Text>
                </TouchableOpacity>
              ) : null}
              <MapSpotDetail
                spot={selectedSpot}
                spotDetails={spotDetails}
                spotDetailsLoading={spotDetailsLoading}
                spotDetailsError={spotDetailsError}
                availableSpecies={availableSpecies}
                predictions={speciesPredictions}
                predictionsLoading={speciesPredictionsLoading}
                predictionsUpdating={speciesPredictionsUpdating}
                predictionsError={speciesPredictionsError}
                isOffline={isOffline}
                skyCondition={speciesSkyCondition}
                temperatureF={speciesTemperatureF}
                contextSubtitle={speciesContextSubtitle}
                onLogFish={onLogSpotFish}
                onSpeciesPress={onSpeciesPress}
                personalCatchTimes={personalCatchTimes}
                personalSpeciesNear={personalSpeciesNear}
                onRetryPredictions={onRetryPredictions}
                onRetryCatchTimes={onRetryCatchTimes}
              />
            </>
          ) : null}

          {showDiscovery ? (
            <DiscoveryDashboard
              categories={categorizedSpots}
              status={discoveryStatus}
              onSpotPress={onSpotPress}
              selectedSpotId={selectedSpotId}
              usingCachedDiscovery={usingCachedDiscovery}
            />
          ) : null}

          {showExtras ? (
            <MapDashboardContent
              bestTime={bestTime}
              weather={weather}
              recommendations={recommendations}
              offlineMap={offlineMap}
              insights={insights}
              onViewInsights={onViewInsights}
              onUseRecommendation={onUseRecommendation}
            />
          ) : null}
      </>
    );

    if (panelMode) {
      return (
        <View
          style={[
            styles.panel,
            {
              width: panelWidth,
              backgroundColor: colors.card,
              borderLeftColor: colors.border,
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {sheetBody}
          </ScrollView>
        </View>
      );
    }

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        onChange={handleSheetChange}
        enablePanDownToClose={false}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {sheetBody}
        </BottomSheetScrollView>
      </BottomSheet>
    );
  }
);

MapBottomSheet.displayName = 'MapBottomSheet';

function formatSpotSubtitle(spot: NearbySpot) {
  return `${spot.matchedSpecies.slice(0, 2).join(', ') || 'Fishing spot'}`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 12,
    borderLeftWidth: 1,
  },
  sheetBackground: {
    backgroundColor: colors.card,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  handleIndicator: {
    backgroundColor: colors.brandAccentMuted,
    width: 36,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  peekHeader: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
    color: colors.brandAccent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  peekTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: colors.text,
  },
  peekSubtitle: {
    fontSize: FontSizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  peekRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  peekChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '48%',
    backgroundColor: colors.cardLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  peekChipText: {
    flexShrink: 1,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
    color: colors.text,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backRowText: {
    color: colors.accent,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  peekSkeletonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  loadingSpecies: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  loadingSpeciesText: {
    color: colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  notice: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: colors.cardLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  offlineNotice: {
    borderColor: colors.error,
    backgroundColor: colors.errorSurface,
  },
  noticeText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: FontSizes.sm,
    minWidth: '60%',
  },
  settingsButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  settingsButtonText: {
    color: colors.accentForeground,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.error,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  retryText: {
    color: colors.accentForeground,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
  },
  emptySpecies: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: colors.cardLight,
    borderRadius: BorderRadius.md,
  },
  emptySpeciesText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: FontSizes.sm,
    lineHeight: 18,
  },
  });
}

export default MapBottomSheet;
