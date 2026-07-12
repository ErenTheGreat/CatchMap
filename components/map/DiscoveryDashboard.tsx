import React, { useCallback, useMemo, useState, memo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
// Gesture-handler FlatList so horizontal swipes don't fight the sheet's pan gesture.
import { FlatList } from 'react-native-gesture-handler';
import { Anchor, Bookmark, Calendar, ChevronRight, Navigation, Search, Users, Waves, ZoomIn } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import type { CategorizedSpotsResponse } from '@/lib/types/categorizedSpots';
import type { NearbySpot } from '@/utils/recommendations';
import { formatDistance, getWaterTypeIcon } from '@/utils/recommendations';
import { getActivityColor, getActivityLabel, type ActivityRating } from '@/utils/fishingEngine';
import {
  filterDiscoverySpots,
  getCloseRankedSpots,
  HOT_NOW_MIN_RATING,
  sortSpotsByDiscoveryScore,
  type DiscoveryFilter,
  type RankedDiscoverySpot,
  type SpotDiscoveryScore,
} from '@/utils/spotDiscoveryScore';
import BiteScoreBreakdown from '@/components/map/BiteScoreBreakdown';
import TripPlannerCard from '@/components/map/TripPlannerCard';
import FishTodayCard from '@/components/pro/FishTodayCard';
import SpotCompareCard from '@/components/pro/SpotCompareCard';
import WeekendPlannerCard from '@/components/pro/WeekendPlannerCard';
import AutopilotSaturdayCard from '@/components/pro/AutopilotSaturdayCard';
import LurePulseCard from '@/components/pro/LurePulseCard';
import ProUpsellCard from '@/components/pro/ProUpsellCard';
import { useProFeature } from '@/hooks/useProFeature';
import SavedSpotsSection from '@/components/map/SavedSpotsSection';
import WaypointsSection from '@/components/map/WaypointsSection';
import type { RecentSpotSnapshot, SavedSpotSnapshot } from '@/lib/types/savedSpot';
import type { PersonalBiteFingerprint } from '@/lib/types/personalBite';
import type { WeatherSnapshot } from '@/lib/api/endpoints/weather';
import type { WaypointRecord } from '@/lib/types/waypoint';
import type { PersonalSpeciesNear } from '@/lib/types/catchInsights';
import type { SpeciesPrediction, CatchActivityRow } from '@/lib/types/speciesPrediction';
import type { SpotTrustResult } from '@/utils/spotTrustScore';
import { openSpotInMaps } from '@/utils/openSpotInMaps';
import { hapticLight } from '@/utils/haptics';
import { useTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import ThemedText from '@/components/ui/ThemedText';
import { EmptyState, LoadingState, FadeInView, ScalePressable } from '@/components/ui';

export type DiscoveryDashboardStatus =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'offline-empty'
  | 'zoom-out'
  | 'waiting-for-map';

interface DiscoveryDashboardProps {
  categories: CategorizedSpotsResponse;
  status: DiscoveryDashboardStatus;
  onSpotPress: (spot: NearbySpot) => void;
  /** Highlights the card matching the map's selected pin. */
  selectedSpotId?: string | null;
  usingCachedDiscovery?: boolean;
  scoresBySpotId?: Record<string, SpotDiscoveryScore>;
  topSpots?: RankedDiscoverySpot[];
  rankedDiscoverySpots?: RankedDiscoverySpot[];
  speciesBySpotId?: Record<string, SpeciesPrediction[]>;
  personalSpecies?: PersonalSpeciesNear[];
  isScoring?: boolean;
  isEnriching?: boolean;
  isOffline?: boolean;
  onGoToBestSpot?: (spot: NearbySpot) => void;
  onPlanTrip?: () => void;
  savedSpots?: SavedSpotSnapshot[];
  recentSpots?: RecentSpotSnapshot[];
  isSpotSaved?: (spotId: string) => boolean;
  onToggleSpotSaved?: (spot: NearbySpot) => void;
  onSavedSpotPress?: (snapshot: SavedSpotSnapshot) => void;
  waypoints?: WaypointRecord[];
  onWaypointPress?: (waypoint: WaypointRecord) => void;
  onDeleteWaypoint?: (waypointId: string) => void;
  fingerprint?: PersonalBiteFingerprint;
  weather?: WeatherSnapshot | null;
  onLogCatch?: (spot: NearbySpot, speciesName: string) => void;
  communityBySpotId?: Record<string, CatchActivityRow[]>;
  discoverySpots?: NearbySpot[];
  trustBySpotId?: Record<string, SpotTrustResult>;
}

const CARD_WIDTH = 168;
const FILTER_OPTIONS: { id: DiscoveryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'hot', label: 'Hot now' },
  { id: 'active', label: 'Active catches' },
  { id: 'nearest', label: 'Nearest' },
];

function ActivityBar({
  rating,
  styles,
  colors,
}: {
  rating: ActivityRating;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  return (
    <View
      style={styles.activityBarTrack}
      accessibilityLabel={`Activity level ${rating} out of 5, ${getActivityLabel(rating)}`}
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

function DiscoveryDashboard({
  categories,
  status,
  onSpotPress,
  selectedSpotId = null,
  usingCachedDiscovery = false,
  scoresBySpotId = {},
  topSpots = [],
  rankedDiscoverySpots = [],
  speciesBySpotId = {},
  personalSpecies = [],
  isScoring = false,
  isEnriching = false,
  isOffline = false,
  onGoToBestSpot,
  onPlanTrip,
  savedSpots = [],
  recentSpots = [],
  isSpotSaved,
  onToggleSpotSaved,
  onSavedSpotPress,
  waypoints = [],
  onWaypointPress,
  onDeleteWaypoint,
  fingerprint,
  weather,
  onLogCatch,
  communityBySpotId = {},
  discoverySpots = [],
  trustBySpotId = {},
}: DiscoveryDashboardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { enabled: tripPlannerEnabled } = useProFeature('trip_planner');
  const [filter, setFilter] = useState<DiscoveryFilter>('all');

  const hasScores = Object.keys(scoresBySpotId).length > 0;
  const compareSpots = useMemo(() => getCloseRankedSpots(topSpots), [topSpots]);

  const trendingSpots = useMemo(
    () =>
      [...topSpots]
        .filter((item) => (item.score.communityCatchCount ?? 0) > 0)
        .sort((a, b) => (b.score.communityCatchCount ?? 0) - (a.score.communityCatchCount ?? 0))
        .slice(0, 3),
    [topSpots]
  );

  const displayTopSpots = useMemo(() => {
    if (filter === 'hot') {
      return topSpots.filter(
        (item) => item.score.activityRating >= HOT_NOW_MIN_RATING
      );
    }
    if (filter === 'active') {
      return topSpots.filter((item) => item.score.hasCommunityActivity);
    }
    if (filter === 'nearest') {
      return [...topSpots].sort((a, b) => a.spot.distance - b.spot.distance);
    }
    return topSpots;
  }, [filter, topSpots]);

  const speciesRankSpots = useMemo(() => {
    const base =
      rankedDiscoverySpots.length > 0
        ? rankedDiscoverySpots
        : topSpots;
    if (filter === 'nearest') {
      return [...base].sort((a, b) => a.spot.distance - b.spot.distance);
    }
    if (filter === 'hot') {
      return base.filter((item) => item.score.activityRating >= HOT_NOW_MIN_RATING);
    }
    if (filter === 'active') {
      return base.filter((item) => item.score.hasCommunityActivity);
    }
    return base;
  }, [filter, rankedDiscoverySpots, topSpots]);

  const sortedCategories = useMemo(() => {
    if (!hasScores) return categories;

    return categories.map((group) => ({
      ...group,
      spots: filterDiscoverySpots(group.spots, scoresBySpotId, filter),
    }));
  }, [categories, filter, hasScores, scoresBySpotId]);

  const totalFilteredSpots = useMemo(
    () => sortedCategories.reduce((sum, group) => sum + group.spots.length, 0),
    [sortedCategories]
  );

  const renderSpotCard = useCallback(
    ({ item, index }: { item: NearbySpot; index: number }) => {
      const isSelected = item.id === selectedSpotId;
      const score = scoresBySpotId[item.id];
      const activityLabel = score ? getActivityLabel(score.activityRating) : null;

      return (
        <FadeInView delay={Math.min(index * 45, 225)} style={styles.spotCardWrap}>
          <ScalePressable
            style={[styles.spotCard, isSelected && styles.spotCardSelected]}
            onPress={() => onSpotPress(item)}
            accessibilityRole="button"
            accessibilityLabel={
              activityLabel
                ? `${item.name}, ${activityLabel.toLowerCase()} bite, ${formatDistance(item.distance)}`
                : `${item.name}, ${formatDistance(item.distance)}`
            }
          >
          <View style={styles.spotIcon}>
            <Anchor color={colors.accent} size={18} />
          </View>
          <ThemedText style={styles.spotName} numberOfLines={2}>
            {item.name}
          </ThemedText>
          {score ? (
            <View style={styles.spotActivityRow}>
              <ActivityBar rating={score.activityRating} styles={styles} colors={colors} />
              <ThemedText style={[styles.spotActivityLabel, { color: getActivityColor(score.activityRating) }]}>
                {activityLabel}
              </ThemedText>
            </View>
          ) : null}
          {score?.hasCommunityActivity ? (
            <View style={styles.communityBadge}>
              <Users color={colors.community} size={11} />
              <ThemedText style={styles.communityBadgeText}>
                {score.communityCatchCount} recent {score.communityCatchCount === 1 ? 'catch' : 'catches'}
              </ThemedText>
            </View>
          ) : null}
          <View style={styles.spotMeta}>
            <Waves color={colors.textMuted} size={12} />
            <ThemedText style={styles.spotType}>{getWaterTypeIcon(item.water_type)}</ThemedText>
          </View>
          <ThemedText style={styles.spotDistance}>{formatDistance(item.distance)}</ThemedText>
          </ScalePressable>
        </FadeInView>
      );
    },
    [onSpotPress, selectedSpotId, scoresBySpotId, styles, colors]
  );

  const renderBestNowCard = useCallback(
    ({ item, index }: { item: RankedDiscoverySpot; index: number }) => {
      const { spot, score, rank } = item;
      const activityLabel = getActivityLabel(score.activityRating);
      const isSelected = spot.id === selectedSpotId;
      const saved = isSpotSaved?.(spot.id) ?? false;

      return (
        <FadeInView delay={Math.min(index * 50, 250)} style={styles.bestNowCardWrap}>
        <View style={[styles.bestNowCard, isSelected && styles.spotCardSelected]}>
          <TouchableOpacity
            style={styles.bestNowMain}
            onPress={() => onSpotPress(spot)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Rank ${rank}, ${spot.name}, ${activityLabel.toLowerCase()} bite, ${formatDistance(spot.distance)}`}
          >
            <View style={styles.bestNowRank}>
              <ThemedText style={styles.bestNowRankText}>#{rank}</ThemedText>
            </View>
            <ThemedText style={styles.bestNowName} numberOfLines={2}>
              {spot.name}
            </ThemedText>
            <ActivityBar rating={score.activityRating} styles={styles} colors={colors} />
            <ThemedText style={[styles.bestNowLabel, { color: getActivityColor(score.activityRating) }]}>
              {activityLabel} bite
            </ThemedText>
            {score.topSpeciesHint ? (
              <ThemedText style={styles.bestNowSpecies} numberOfLines={1}>
                Likely: {score.topSpeciesHint}
                {score.topSpeciesProbability != null ? ` (${score.topSpeciesProbability}%)` : ''}
              </ThemedText>
            ) : null}
            {score.hasCommunityActivity ? (
              <View style={styles.communityBadge}>
                <Users color={colors.community} size={11} />
                <ThemedText style={styles.communityBadgeText}>
                  {score.communityCatchCount} angler {score.communityCatchCount === 1 ? 'catch' : 'catches'}
                </ThemedText>
              </View>
            ) : null}
            <ThemedText style={styles.bestNowDistance}>{formatDistance(spot.distance)}</ThemedText>
          </TouchableOpacity>
          <View style={styles.bestNowActions}>
            {onToggleSpotSaved ? (
              <TouchableOpacity
                style={styles.cardActionButton}
                onPress={() => {
                  hapticLight();
                  onToggleSpotSaved(spot);
                }}
                accessibilityRole="button"
                accessibilityLabel={saved ? `Unsave ${spot.name}` : `Save ${spot.name}`}
              >
                <Bookmark
                  color={saved ? colors.accent : colors.textMuted}
                  size={16}
                  fill={saved ? colors.accent : 'transparent'}
                />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.cardActionButton}
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
              <Navigation color={colors.accent} size={16} />
            </TouchableOpacity>
          </View>
        </View>
        </FadeInView>
      );
    },
    [colors, isSpotSaved, onSpotPress, onToggleSpotSaved, selectedSpotId, styles]
  );

  const spotKeyExtractor = useCallback((item: NearbySpot) => item.id, []);
  const bestNowKeyExtractor = useCallback((item: RankedDiscoverySpot) => item.spot.id, []);

  if (status === 'waiting-for-map' || status === 'loading') {
    return (
      <LoadingState
        compact
        message={
          status === 'waiting-for-map'
            ? 'Loading map view…'
            : 'Loading waters in view…'
        }
      />
    );
  }

  if (status === 'zoom-out') {
    return (
      <EmptyState
        icon={<ZoomIn color={colors.accent} size={36} />}
        title="Zoom in to see spots"
        subtitle="The map is showing too large an area. Pinch to zoom in, then browse waters in the visible region."
      />
    );
  }

  if (status === 'offline-empty') {
    return (
      <EmptyState
        icon={<Search color={colors.textMuted} size={32} />}
        title="No saved waters in this view"
        subtitle="Connect briefly while viewing this area to cache lakes and creeks for offline use. Saved and nearby spots still appear when you are close to them."
      />
    );
  }

  if (status === 'empty') {
    return (
      <EmptyState
        icon={<Search color={colors.textMuted} size={32} />}
        title="No waters in this view"
        subtitle="Pan or zoom the map to explore a different region, or search for a location by name."
      />
    );
  }

  const bestSpot = topSpots[0]?.spot;
  const topScore = topSpots[0]?.score;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Waters in View</ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          {usingCachedDiscovery
            ? 'Saved discovery data — reconnect for live updates'
            : hasScores
              ? 'Based on weather, tides, solunar, and spot habitat'
              : 'Browse by category anywhere on the map'}
        </ThemedText>
        {isOffline && hasScores ? (
          <ThemedText style={styles.offlineBadge}>Scores use cached weather</ThemedText>
        ) : null}
      </View>

      {onWaypointPress ? (
        <View style={styles.waypointsSection}>
          <ThemedText style={styles.sectionTitle}>My waypoints</ThemedText>
          <WaypointsSection
            waypoints={waypoints}
            onWaypointPress={onWaypointPress}
            onDeleteWaypoint={onDeleteWaypoint}
          />
        </View>
      ) : null}

      {onSavedSpotPress ? (
        <SavedSpotsSection
          savedSpots={savedSpots}
          recentSpots={recentSpots}
          onSpotPress={onSavedSpotPress}
          selectedSpotId={selectedSpotId}
          trustBySpotId={trustBySpotId}
        />
      ) : null}

      {onPlanTrip ? (
        tripPlannerEnabled ? (
          <ScalePressable
            style={styles.planTripButton}
            onPress={onPlanTrip}
            accessibilityRole="button"
            accessibilityLabel="Plan my fishing trip"
          >
            <Calendar color={colors.accentForeground} size={18} />
            <ThemedText style={styles.planTripText}>Plan my trip</ThemedText>
            <ChevronRight color={colors.accentForeground} size={18} />
          </ScalePressable>
        ) : (
          <ProUpsellCard
            compact
            title="Trip planner"
            description="Rank spots for today, tomorrow, or Saturday — with calendar and reminders."
          />
        )
      ) : null}

      {bestSpot && onGoToBestSpot ? (
        <ScalePressable
          style={styles.goToBestButton}
          onPress={() => onGoToBestSpot(bestSpot)}
          accessibilityRole="button"
          accessibilityLabel={`Go to best spot, ${bestSpot.name}, ${getActivityLabel(topSpots[0].score.activityRating).toLowerCase()} bite`}
        >
          <View style={styles.goToBestContent}>
            <ThemedText style={styles.goToBestTitle}>Go to best spot</ThemedText>
            <ThemedText style={styles.goToBestSubtitle} numberOfLines={1}>
              {bestSpot.name} — {getActivityLabel(topSpots[0].score.activityRating)} bite
            </ThemedText>
          </View>
          <ChevronRight color={colors.accentForeground} size={20} />
        </ScalePressable>
      ) : null}

      {trendingSpots.length > 0 ? (
        <View style={styles.trendingSection}>
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={styles.sectionTitle}>Trending near you</ThemedText>
            <Users color={colors.community} size={16} />
          </View>
          {trendingSpots.map((item) => (
            <TouchableOpacity
              key={item.spot.id}
              style={styles.trendingRow}
              onPress={() => onSpotPress(item.spot)}
              activeOpacity={0.75}
            >
              <ThemedText style={styles.trendingName} numberOfLines={1}>
                {item.spot.name}
              </ThemedText>
              <ThemedText style={styles.trendingMeta}>
                {item.score.communityCatchCount} angler{' '}
                {item.score.communityCatchCount === 1 ? 'catch' : 'catches'}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {isScoring || displayTopSpots.length > 0 ? (
        <View style={styles.bestNowSection}>
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={styles.sectionTitle}>
              {filter === 'hot' ? 'Hot right now' : 'Best right now'}
            </ThemedText>
            {isScoring || isEnriching ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : null}
          </View>
          {isScoring && displayTopSpots.length === 0 ? (
            <View style={styles.scoringRow}>
              <ThemedText style={styles.scoringText}>Ranking bite activity for nearby waters…</ThemedText>
            </View>
          ) : (
            <FlatList
              horizontal
              data={displayTopSpots}
              keyExtractor={bestNowKeyExtractor}
              renderItem={renderBestNowCard}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              nestedScrollEnabled
            />
          )}
        </View>
      ) : null}

      {filter === 'hot' && hasScores && !isScoring && totalFilteredSpots === 0 ? (
        <View style={styles.emptyHotContainer}>
          <ThemedText style={styles.emptyHotTitle}>No hot bites in this view</ThemedText>
          <ThemedText style={styles.emptyHotSubtitle}>
            Nothing is rating Hot (4+) right now. Try All, zoom to a smaller area, or check
            back near dawn or dusk.
          </ThemedText>
        </View>
      ) : null}

      {(speciesRankSpots.length > 0 || displayTopSpots.length > 0 || isEnriching) ? (
        <View style={styles.insightSection}>
          <FishTodayCard
            rankedSpots={speciesRankSpots}
            topSpots={displayTopSpots}
            speciesBySpotId={speciesBySpotId}
            personalSpecies={personalSpecies}
            weather={weather}
            isEnriching={isEnriching}
            onSpotPress={onSpotPress}
            onLogCatch={onLogCatch}
          />
        </View>
      ) : null}

      {discoverySpots.length > 0 ? (
        <View style={styles.insightSection}>
          <LurePulseCard communityBySpotId={communityBySpotId} spots={discoverySpots} />
        </View>
      ) : null}

      {savedSpots.length > 0 ? (
        <View style={styles.insightSection}>
          <WeekendPlannerCard savedSpots={savedSpots} onSpotPress={onSpotPress} />
        </View>
      ) : null}

      {savedSpots.length > 0 ? (
        <View style={styles.insightSection}>
          <AutopilotSaturdayCard savedSpots={savedSpots} onSpotPress={onSpotPress} />
        </View>
      ) : null}

      {topScore ? (
        <View style={styles.insightSection}>
          <BiteScoreBreakdown
            score={topScore}
            spotName={bestSpot?.name}
            compact
            contextLabel="Compared to nearby spots on map"
          />
        </View>
      ) : null}

      {tripPlannerEnabled && topScore && (topScore.hourlyForecast?.length ?? 0) > 0 ? (
        <View style={styles.insightSection}>
          <TripPlannerCard
            hourlyForecast={topScore.hourlyForecast ?? []}
            spotName={bestSpot?.name}
            latitude={bestSpot?.latitude}
            longitude={bestSpot?.longitude}
            onGoToSpot={bestSpot && onGoToBestSpot ? () => onGoToBestSpot(bestSpot) : undefined}
            fingerprint={fingerprint}
            weather={weather}
          />
        </View>
      ) : null}

      {compareSpots.length >= 2 ? (
        <View style={styles.insightSection}>
          <SpotCompareCard compareSpots={compareSpots} onSpotPress={onSpotPress} />
        </View>
      ) : null}

      {hasScores ? (
        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((option) => {
            const active = filter === option.id;
            return (
              <ScalePressable
                key={option.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => {
                  hapticLight();
                  setFilter(option.id);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Filter ${option.label}`}
              >
                <ThemedText style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {option.label}
                </ThemedText>
              </ScalePressable>
            );
          })}
        </View>
      ) : null}

      {sortedCategories.map((group) => {
        if (group.spots.length === 0) return null;
        const displaySpots = hasScores
          ? sortSpotsByDiscoveryScore(group.spots, scoresBySpotId)
          : group.spots;

        return (
          <View key={group.category} style={styles.categorySection}>
            <ThemedText style={styles.categoryTitle}>{group.category}</ThemedText>
            <FlatList
              horizontal
              data={displaySpots}
              keyExtractor={spotKeyExtractor}
              renderItem={renderSpotCard}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              nestedScrollEnabled
            />
          </View>
        );
      })}
    </View>
  );
}

export default memo(DiscoveryDashboard);

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      paddingTop: Spacing.xs,
      paddingBottom: Spacing.md,
    },
    insightSection: {
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.sm,
    },
    header: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    headerTitle: {
      color: colors.text,
      fontSize: FontSizes.xl,
      fontWeight: FontWeights.bold,
    },
    headerSubtitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      marginTop: 4,
    },
    offlineBadge: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      marginTop: Spacing.xs,
    },
    goToBestButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: Spacing.md,
      marginBottom: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.lg,
      backgroundColor: colors.accent,
    },
    goToBestContent: {
      flex: 1,
      marginRight: Spacing.sm,
    },
    goToBestTitle: {
      color: colors.accentForeground,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
    },
    goToBestSubtitle: {
      color: colors.accentForeground,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.bold,
      marginTop: 2,
      opacity: 0.95,
    },
    planTripButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginHorizontal: Spacing.md,
      marginBottom: Spacing.sm,
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: colors.community,
    },
    planTripText: {
      flex: 1,
      color: colors.accentForeground,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
    },
    trendingSection: {
      marginHorizontal: Spacing.md,
      marginBottom: Spacing.sm,
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: colors.communityMuted,
      borderWidth: 1,
      borderColor: colors.community,
      gap: Spacing.sm,
    },
    trendingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    trendingName: {
      flex: 1,
      color: colors.text,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    trendingMeta: {
      color: colors.community,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.semibold,
    },
    bestNowSection: {
      marginBottom: Spacing.sm,
    },
    scoringRow: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    scoringText: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
    },
    emptyHotContainer: {
      marginHorizontal: Spacing.md,
      marginBottom: Spacing.md,
      padding: Spacing.md,
      borderRadius: BorderRadius.lg,
      backgroundColor: colors.cardLight,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyHotTitle: {
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      color: colors.text,
    },
    emptyHotSubtitle: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
      marginTop: Spacing.xs,
      lineHeight: 20,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.semibold,
    },
    compareSection: {
      marginHorizontal: Spacing.md,
      marginBottom: Spacing.md,
      padding: Spacing.sm,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      gap: Spacing.xs,
    },
    compareTitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      marginBottom: Spacing.xs,
    },
    compareRow: {
      paddingVertical: Spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    compareName: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
    },
    compareRating: {
      color: colors.accent,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      marginTop: 2,
    },
    compareDistance: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      marginTop: 2,
    },
    compareSpecies: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      marginTop: 2,
    },
    filterRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.md,
    },
    filterChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    filterChipActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentDark,
    },
    filterChipText: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    filterChipTextActive: {
      color: colors.accent,
      fontWeight: FontWeights.semibold,
    },
    categorySection: {
      marginTop: Spacing.md,
    },
    waypointsSection: {
      marginBottom: Spacing.xs,
    },
    categoryTitle: {
      color: colors.text,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.semibold,
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.sm,
    },
    horizontalList: {
      paddingHorizontal: Spacing.md,
      gap: Spacing.sm,
    },
    bestNowCardWrap: {
      marginRight: Spacing.sm,
    },
    bestNowCard: {
      width: CARD_WIDTH + 24,
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    bestNowMain: {
      flex: 1,
      padding: Spacing.md,
    },
    bestNowActions: {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.border,
      backgroundColor: colors.cardLight,
    },
    cardActionButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bestNowRank: {
      alignSelf: 'flex-start',
      backgroundColor: colors.accentDark,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
      marginBottom: Spacing.xs,
    },
    bestNowRankText: {
      color: colors.accent,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.bold,
    },
    bestNowName: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      minHeight: 40,
    },
    bestNowLabel: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      marginTop: Spacing.xs,
    },
    bestNowSpecies: {
      color: colors.textSecondary,
      fontSize: FontSizes.xs,
      marginTop: Spacing.xs,
    },
    bestNowDistance: {
      color: colors.accent,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      marginTop: Spacing.sm,
    },
    spotCardWrap: {
      marginRight: Spacing.sm,
    },
    spotCard: {
      width: CARD_WIDTH,
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    spotCardSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accentDark,
    },
    spotIcon: {
      backgroundColor: colors.accentDark,
      alignSelf: 'flex-start',
      padding: Spacing.sm,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
    },
    spotName: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      minHeight: 40,
    },
    spotActivityRow: {
      marginTop: Spacing.xs,
      gap: 4,
    },
    spotActivityLabel: {
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.semibold,
    },
    communityBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    communityBadgeText: {
      color: colors.community,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.medium,
    },
    activityBarTrack: {
      flexDirection: 'row',
      gap: 3,
      height: 6,
    },
    activityBarSegment: {
      flex: 1,
      borderRadius: 2,
    },
    spotMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.xs,
    },
    spotType: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
    },
    spotDistance: {
      color: colors.accent,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      marginTop: Spacing.sm,
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      padding: Spacing.xl,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: FontSizes.md,
    },
    emptyContainer: {
      alignItems: 'center',
      padding: Spacing.xl,
      paddingHorizontal: Spacing.lg,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.semibold,
      marginTop: Spacing.sm,
    },
    emptySubtitle: {
      color: colors.textMuted,
      fontSize: FontSizes.sm,
      textAlign: 'center',
      marginTop: Spacing.xs,
      lineHeight: 20,
    },
  });
}
