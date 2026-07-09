import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Navigation } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { fishingApi } from '@/lib/api/fishingApi';
import { bboxAroundCenter } from '@/lib/api/endpoints/spatialSpots';
import { useDeviceLocation } from '@/hooks/useDeviceLocation';
import { useWeather } from '@/hooks/useWeather';
import { useTides } from '@/hooks/useTides';
import { useCatchInsights } from '@/hooks/useCatchInsights';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  SegmentedControl,
  ThemedText,
} from '@/components/ui';
import TripPlannerCard from '@/components/map/TripPlannerCard';
import BiteScoreBreakdown from '@/components/map/BiteScoreBreakdown';
import {
  buildScoresBySpotId,
  rankDiscoverySpots,
  scoreSpotsForTripPlanning,
  type RankedDiscoverySpot,
} from '@/utils/spotDiscoveryScore';
import { formatDistance } from '@/utils/recommendations';
import { getActivityColor, getActivityLabel } from '@/utils/fishingEngine';
import { getTripDayOutlook } from '@/utils/bestTimeNow';
import { isPersonalBiteEnabled } from '@/constants/features';
import { buildCatchConditions } from '@/utils/catchConditions';
import { computePersonalBiteBoost } from '@/utils/personalBiteFingerprint';
import { openSpotInMaps } from '@/utils/openSpotInMaps';
import type { NearbySpot } from '@/utils/osmFishingSpots';

type TripWindowOption = 'today' | 'tomorrow' | 'saturday';

const WINDOW_OPTIONS: { id: TripWindowOption; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'saturday', label: 'Saturday AM' },
];

function getTargetDate(option: TripWindowOption): Date {
  const now = new Date();
  if (option === 'today') return now;
  if (option === 'tomorrow') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d;
  }
  const d = new Date(now);
  const day = d.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilSaturday);
  d.setHours(7, 0, 0, 0);
  return d;
}

export default function TripPlannerScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();

  const paramLat = params.lat ? parseFloat(params.lat) : null;
  const paramLng = params.lng ? parseFloat(params.lng) : null;

  const { data: deviceLocation } = useDeviceLocation();
  const latitude = paramLat ?? deviceLocation?.latitude ?? null;
  const longitude = paramLng ?? deviceLocation?.longitude ?? null;

  const [windowOption, setWindowOption] = useState<TripWindowOption>('today');
  const targetDate = useMemo(() => getTargetDate(windowOption), [windowOption]);

  const { data: weather } = useWeather(latitude ?? undefined, longitude ?? undefined);
  const { data: tidesData } = useTides(latitude ?? undefined, longitude ?? undefined);
  const { fingerprint } = useCatchInsights();

  const dayOutlook = useMemo(() => {
    if (latitude == null || longitude == null) return null;
    return getTripDayOutlook({
      latitude,
      longitude,
      weather: weather ?? null,
      date: targetDate,
      tides: tidesData?.predictions ?? null,
    });
  }, [latitude, longitude, weather, targetDate, tidesData?.predictions]);

  const personalBoost = useMemo(() => {
    if (!isPersonalBiteEnabled() || !fingerprint.unlocked || !weather) return 0;
    const conditions = buildCatchConditions(weather);
    const { boost } = computePersonalBiteBoost(fingerprint, {
      hour: targetDate.getHours(),
      conditions,
    });
    return boost;
  }, [fingerprint, weather, targetDate]);

  const spotsQuery = useQuery({
    queryKey: ['tripPlannerSpots', latitude, longitude],
    queryFn: async ({ signal }) => {
      if (latitude == null || longitude == null) return [];
      const bbox = bboxAroundCenter(latitude, longitude, 0.35);
      const categories = await fishingApi.getCategorizedSpotsInBBox(bbox, signal);
      const spots: NearbySpot[] = [];
      for (const group of categories) {
        for (const spot of group.spots) {
          spots.push(spot);
        }
      }
      return spots.slice(0, 50);
    },
    enabled: latitude != null && longitude != null,
    staleTime: 5 * 60 * 1000,
  });

  const rankedSpots = useMemo((): RankedDiscoverySpot[] => {
    const spots = spotsQuery.data ?? [];
    if (spots.length === 0 || !weather) return [];

    const scores = scoreSpotsForTripPlanning(spots, {
      weather,
      tides: tidesData?.predictions ?? null,
      now: targetDate,
      personalBoost,
      tripPlanning: true,
    });
    const scoresBySpotId = buildScoresBySpotId(scores);
    return rankDiscoverySpots(spots, scoresBySpotId).slice(0, 3);
  }, [spotsQuery.data, weather, tidesData?.predictions, targetDate, personalBoost]);

  const handleGoToSpot = (spot: NearbySpot) => {
    router.push({
      pathname: '/(tabs)',
      params: { lat: String(spot.latitude), lng: String(spot.longitude) },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft color={colors.text} size={26} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Plan my trip</ThemedText>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <ThemedText style={styles.intro}>
          Ranked recommendations combining bite forecast, your catch patterns, and community
          activity.
        </ThemedText>

        <ThemedText style={styles.sectionLabel}>When</ThemedText>
        <SegmentedControl
          options={WINDOW_OPTIONS}
          value={windowOption}
          onChange={setWindowOption}
          accessibilityLabel="Trip window"
        />

        {dayOutlook ? (
          <View style={styles.dayOutlook}>
            <View
              style={[
                styles.dayOutlookDot,
                { backgroundColor: getActivityColor(dayOutlook.peakRating) },
              ]}
            />
            <View style={styles.dayOutlookText}>
              <ThemedText style={styles.dayOutlookTitle}>
                Day outlook: {dayOutlook.label}
              </ThemedText>
              <ThemedText style={styles.dayOutlookNote}>{dayOutlook.note}</ThemedText>
            </View>
          </View>
        ) : null}

        {spotsQuery.isLoading ? (
          <LoadingState message="Finding waters near you…" />
        ) : spotsQuery.isError ? (
          <ErrorState
            title="Could not load spots"
            message="Check your connection and try again."
            onRetry={() => void spotsQuery.refetch()}
          />
        ) : rankedSpots.length === 0 ? (
          <EmptyState
            title="No ranked spots yet"
            subtitle="Pan the map to an area with waters, or try a different time window."
            actionLabel="Back to map"
            onAction={() => router.back()}
          />
        ) : (
          rankedSpots.map((item, index) => (
            <View key={item.spot.id} style={styles.spotCard}>
              <View style={styles.spotHeader}>
                <View style={styles.rankBadge}>
                  <ThemedText style={styles.rankText}>#{index + 1}</ThemedText>
                </View>
                <View style={styles.spotTitleBlock}>
                  <ThemedText style={styles.spotName}>{item.spot.name}</ThemedText>
                  <ThemedText style={styles.spotMeta}>
                    {formatDistance(item.spot.distance)} ·{' '}
                    {getActivityLabel(item.score.activityRating)} bite
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.ratingDot,
                    { backgroundColor: getActivityColor(item.score.activityRating) },
                  ]}
                />
              </View>

              <BiteScoreBreakdown score={item.score} spotName={item.spot.name} compact />

              {item.score.hasCommunityActivity ? (
                <ThemedText style={styles.communityLine}>
                  {item.score.communityCatchCount} community{' '}
                  {item.score.communityCatchCount === 1 ? 'catch' : 'catches'} nearby
                </ThemedText>
              ) : null}

              {(item.score.hourlyForecast?.length ?? 0) > 0 ? (
                <TripPlannerCard
                  hourlyForecast={item.score.hourlyForecast}
                  spotName={item.spot.name}
                  latitude={item.spot.latitude}
                  longitude={item.spot.longitude}
                  referenceDate={targetDate}
                  onGoToSpot={() => handleGoToSpot(item.spot)}
                  fingerprint={fingerprint}
                  weather={weather ?? null}
                />
              ) : null}

              <View style={styles.actions}>
                <Button title="View on map" onPress={() => handleGoToSpot(item.spot)} />
                <TouchableOpacity
                  style={styles.navButton}
                  onPress={() =>
                    void openSpotInMaps({
                      latitude: item.spot.latitude,
                      longitude: item.spot.longitude,
                      name: item.spot.name,
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Navigate to ${item.spot.name}`}
                >
                  <Navigation color={colors.accent} size={18} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {spotsQuery.isFetching && !spotsQuery.isLoading ? (
          <View style={styles.refreshRow}>
            <ActivityIndicator color={colors.accent} size="small" />
            <ThemedText style={styles.refreshText}>Updating rankings…</ThemedText>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    headerTitle: {
      color: colors.text,
      fontSize: FontSizes.xxl,
      fontWeight: FontWeights.bold,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: Spacing.lg,
      paddingBottom: Spacing.xxl,
      gap: Spacing.md,
    },
    intro: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      lineHeight: 20,
    },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    dayOutlook: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.sm,
    },
    dayOutlookDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginTop: 4,
    },
    dayOutlookText: {
      flex: 1,
      gap: 2,
    },
    dayOutlookTitle: {
      color: colors.text,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
    },
    dayOutlookNote: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      lineHeight: 16,
    },
    spotCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    spotHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    rankBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.accentDark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: {
      color: colors.accent,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.bold,
    },
    spotTitleBlock: {
      flex: 1,
      gap: 2,
    },
    spotName: {
      color: colors.text,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.semibold,
    },
    spotMeta: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
    },
    ratingDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    communityLine: {
      color: colors.community,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    navButton: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardLight,
    },
    refreshRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    refreshText: {
      color: colors.textMuted,
      fontSize: FontSizes.sm,
    },
  });
}
