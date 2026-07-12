import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fish, Info, MapPin, X } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import BrandMark from '@/components/brand/BrandMark';
import { AppScreenHeader, estimateHeroHeaderHeight, type HeroCollapseLevel } from '@/components/ui';
import {
  getSpeciesRecommendations,
  RecommendedSpecies,
  NearbySpot,
  calculateDistance,
} from '@/utils/recommendations';
import { getBestTimeNow } from '@/utils/bestTimeNow';
import { summarizeCommunityCatchActivity } from '@/utils/communityCatchIntel';
import { confirmDiscardUnsavedChanges } from '@/utils/unsavedChanges';
import { buildLocationSpeciesGuide } from '@/utils/speciesGuide';
import { buildCatchCoachAdvice } from '@/utils/catchCoach';
import { getPrimaryLureLabel } from '@/utils/speciesRigs';
import speciesData from '@/data/species.json';
import FishingMap from '@/components/FishingMap';
import { MAP_LEGEND_ESTIMATED_HEIGHT } from '@/components/map/MapLegend';
import MapBottomSheet, { type MapBottomSheetHandle } from '@/components/map/MapBottomSheet';
import SpeciesGuideSheet from '@/components/map/SpeciesGuideSheet';
import MapLocationSearchBar, {
  type MapLocationSearchBarHandle,
} from '@/components/map/MapLocationSearchBar';
import MapOverlayControls from '@/components/map/MapOverlayControls';
import MapLayerSheet from '@/components/map/MapLayerSheet';
import WaypointSaveModal from '@/components/map/WaypointSaveModal';
import { BOTTOM_SHEET_PEEK_HEIGHT, getSheetHeightForIndex } from '@/components/map/mapSheetConstants';
import type { FlyToTarget, MapLongPressCoords } from '@/components/map/types';
import { useDeviceLocation } from '@/hooks/useDeviceLocation';
import { useLocalFishingData } from '@/hooks/useLocalFishingData';
import { useNetworkStatus } from '@/providers/NetworkProvider';
import { DEFAULT_RADIUS_METERS } from '@/lib/api/endpoints/localSpecies';
import type { ActiveCoordinates, LocationSearchResult } from '@/lib/types/mapCoordinates';
import { useCategorizedSpots } from '@/hooks/useCategorizedSpots';
import type { DiscoveryDashboardStatus } from '@/components/map/DiscoveryDashboard';
import { useOfflineMap } from '@/hooks/useOfflineMap';
import { useSaveCatch, useSyncCatches } from '@/hooks/useCatches';
import { useCatchInsights } from '@/hooks/useCatchInsights';
import { getAreaRegulationNotices } from '@/utils/fishingRegulations';
import { useWeather } from '@/hooks/useWeather';
import { useTides } from '@/hooks/useTides';
import { useSpotDetails } from '@/hooks/useSpotDetails';
import { useSpeciesPrediction } from '@/hooks/useSpeciesPrediction';
import { useViewportSpotScores } from '@/hooks/useViewportSpotScores';
import { useSpotTrustScores } from '@/hooks/useSpotTrustScores';
import { useRegionEnrichment } from '@/hooks/useRegionEnrichment';
import { useWaypoints } from '@/hooks/useWaypoints';
import type { WaypointRecord } from '@/lib/types/waypoint';
import { useMapLayers } from '@/hooks/useMapLayers';
import type { MapLayerState } from '@/lib/mapLayers/config';
import { isPersonalBiteEnabled, isCloudSyncEnabled, isOnWaterCopilotEnabled } from '@/constants/features';
import { useProFeature } from '@/hooks/useProFeature';
import { PRO_UPGRADE_HREF } from '@/constants/routes';
import { getMaxWaypoints } from '@/constants/pro';
import { usePro } from '@/providers/ProProvider';
import { savedSpotToNearbySpot, type SavedSpotSnapshot } from '@/lib/types/savedSpot';
import { getSpotLogSpeciesOptions } from '@/lib/species/spotLogSpecies';
import { prefetchSpotData } from '@/lib/species/prefetchSpotData';
import { queryClient } from '@/lib/queryClient';
import { searchResultToNearbySpot } from '@/lib/api/endpoints/locationsSearch';
import type { LocationSpeciesGuide } from '@/lib/types/speciesGuide';
import type { CatchCoachAdvice } from '@/lib/types/catchCoach';
import type { CatchCoachContext } from '@/hooks/useCatchCoachAdvice';
import type { AvailableSpecies, SpeciesPrediction } from '@/lib/types/speciesPrediction';
import LogCatchForm, { type LogCatchFormValues } from '@/components/catch/LogCatchForm';
import { resolveCatchLocationFromMap } from '@/utils/catchLocation';
import { useSavedSpots } from '@/providers/SavedSpotsProvider';
import { useLogFormGuard, useLogFormGuardDiscard } from '@/providers/LogFormGuardProvider';
import { buildCatchConditions } from '@/utils/catchConditions';
import { buildBiteHeatmapGeoJson, getBiteHeatmapStatus } from '@/utils/biteHeatmap';
import { computePersonalBiteBoost } from '@/utils/personalBiteFingerprint';
import { useToast } from '@/components/ui';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useTheme } from '@/providers/ThemeProvider';
import { hapticLight, hapticSuccess, hapticWarning, hapticError } from '@/utils/haptics';
import { showCatchSavedFeedback } from '@/utils/catchSaveFeedback';
import OnWaterCopilotSheet from '@/components/pro/OnWaterCopilotSheet';
import { findNearestWaterSpot, isNearWater } from '@/utils/nearWater';

export default function MapScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { enabled: tripPlannerEnabled } = useProFeature('trip_planner');
  const { enabled: premiumMapLayersPro, loading: premiumLayersLoading } =
    useProFeature('premium_map_layers');
  const { lat: flyLatParam, lng: flyLngParam } = useLocalSearchParams<{
    lat?: string;
    lng?: string;
  }>();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isWide, mapPanelWidth, modalMaxWidth } = useResponsiveLayout();
  const sheetRef = useRef<MapBottomSheetHandle>(null);
  const recentMapTapRef = useRef(false);
  const mapTapResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBarRef = useRef<MapLocationSearchBarHandle>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [heroHeaderHeight, setHeroHeaderHeight] = useState(
    estimateHeroHeaderHeight('full', insets.top)
  );

  const {
    data: deviceLocation,
    isLoading: gpsLoading,
    refetch: refetchDeviceLocation,
  } = useDeviceLocation();

  const [activeCoords, setActiveCoords] = useState<ActiveCoordinates | null>(null);
  const [mapCenterKey, setMapCenterKey] = useState(0);
  const [showLegend, setShowLegend] = useState(true);
  const [layerSheetVisible, setLayerSheetVisible] = useState(false);
  const [waypointModalVisible, setWaypointModalVisible] = useState(false);
  const [pendingWaypointCoords, setPendingWaypointCoords] = useState<MapLongPressCoords | null>(null);
  const [flyToTarget, setFlyToTarget] = useState<FlyToTarget | null>(null);
  const [fabBottomOffset, setFabBottomOffset] = useState(BOTTOM_SHEET_PEEK_HEIGHT);

  useEffect(() => {
    if (deviceLocation && activeCoords === null) {
      setActiveCoords({
        latitude: deviceLocation.latitude,
        longitude: deviceLocation.longitude,
        source: 'gps',
      });
    }
  }, [deviceLocation, activeCoords]);

  const lastFlyParamsRef = useRef<string | null>(null);
  useEffect(() => {
    if (!flyLatParam || !flyLngParam) return;
    const key = `${flyLatParam},${flyLngParam}`;
    if (lastFlyParamsRef.current === key) return;
    lastFlyParamsRef.current = key;

    const lat = parseFloat(flyLatParam);
    const lng = parseFloat(flyLngParam);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    setActiveCoords({
      latitude: lat,
      longitude: lng,
      source: 'search',
      label: 'Catch location',
    });
    setFlyToTarget({ lat, lng, key: Date.now(), zoom: 14 });
    sheetRef.current?.snapToIndex(0);
  }, [flyLatParam, flyLngParam]);

  const { isOffline } = useNetworkStatus();

  const {
    species: localSpecies,
    isLoading: speciesLoading,
    isFetchingSpecies,
    refetchSpecies,
  } = useLocalFishingData(
    activeCoords?.latitude,
    activeCoords?.longitude,
    DEFAULT_RADIUS_METERS
  );

  const location = useMemo(
    () =>
      activeCoords
        ? { latitude: activeCoords.latitude, longitude: activeCoords.longitude }
        : null,
    [activeCoords]
  );

  const userMarkerLocation = useMemo(() => {
    if (
      activeCoords?.source === 'search' &&
      deviceLocation &&
      !deviceLocation.isDefault &&
      !deviceLocation.permissionDenied
    ) {
      return {
        latitude: deviceLocation.latitude,
        longitude: deviceLocation.longitude,
      };
    }
    return location;
  }, [activeCoords?.source, deviceLocation, location]);

  /** Keep the map camera anchor at GPS while search uses flyToTarget for animation. */
  const mapCameraAnchor = useMemo(() => {
    if (!location) return null;
    if (
      activeCoords?.source === 'search' &&
      deviceLocation &&
      !deviceLocation.isDefault
    ) {
      return {
        latitude: deviceLocation.latitude,
        longitude: deviceLocation.longitude,
      };
    }
    return location;
  }, [activeCoords?.source, deviceLocation, location]);

  const permissionDenied = deviceLocation?.permissionDenied ?? false;
  const isSearchingLocation = activeCoords?.source === 'search';

  const handleSelectSearchLocation = useCallback((result: LocationSearchResult) => {
    hapticLight();
    const spot = searchResultToNearbySpot(result);

    setActiveCoords({
      latitude: result.latitude,
      longitude: result.longitude,
      source: 'search',
      label: result.name,
    });
    setSelectedSpotId(spot.id);
    setSelectedSpotSnapshot(spot);
    setFlyToTarget({
      lat: result.latitude,
      lng: result.longitude,
      key: Date.now(),
      zoom: 14,
    });
    sheetRef.current?.snapToIndex(1);
  }, []);

  const handleRecenterOnGps = useCallback(async () => {
    const { data: freshLocation } = await refetchDeviceLocation();
    const gps = freshLocation ?? deviceLocation;
    if (!gps) return;

    setActiveCoords({
      latitude: gps.latitude,
      longitude: gps.longitude,
      source: 'gps',
      label: undefined,
    });
    setSelectedSpotId(null);
    setSelectedSpotSnapshot(null);
    setFlyToTarget(null);
    setMapCenterKey((key) => key + 1);
  }, [refetchDeviceLocation, deviceLocation]);

  const {
    categories: categorizedSpots,
    mapSpots: discoverySpots,
    onViewportChange,
    isFetching: loadingCategorizedSpots,
    zoomedOutTooFar,
    hasViewport,
    usingCachedDiscovery,
    viewportBBox,
  } = useCategorizedSpots(location?.latitude, location?.longitude);

  const viewportCenter = useMemo(() => {
    if (!viewportBBox) return null;
    return {
      latitude: (viewportBBox[1] + viewportBBox[3]) / 2,
      longitude: (viewportBBox[0] + viewportBBox[2]) / 2,
    };
  }, [viewportBBox]);

  useRegionEnrichment({
    latitude: viewportCenter?.latitude ?? null,
    longitude: viewportCenter?.longitude ?? null,
    enabled: hasViewport && !zoomedOutTooFar,
  });

  const discoveryStatus = useMemo((): DiscoveryDashboardStatus => {
    if (!hasViewport) return 'waiting-for-map';
    if (zoomedOutTooFar) return 'zoom-out';
    if (loadingCategorizedSpots && categorizedSpots.length === 0) return 'loading';
    if (categorizedSpots.length === 0) {
      return isOffline ? 'offline-empty' : 'empty';
    }
    return 'ready';
  }, [
    hasViewport,
    zoomedOutTooFar,
    loadingCategorizedSpots,
    categorizedSpots.length,
    isOffline,
  ]);

  const recommendations = useMemo(
    () =>
      location ? getSpeciesRecommendations(location.latitude, location.longitude) : [],
    [location]
  );

  const [timeTick, setTimeTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTimeTick((t) => t + 1), 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const currentHour = useMemo(() => {
    void timeTick;
    return new Date().getHours();
  }, [timeTick]);

  const offlineMap = useOfflineMap(location?.latitude, location?.longitude);
  const { data: weather } = useWeather(location?.latitude, location?.longitude);
  const { data: tidesData } = useTides(location?.latitude, location?.longitude);
  const { getPersonalCatchTimesNear, getPersonalSpeciesNear, insights, fingerprint, catches } = useCatchInsights();
  const { savedSpots, recentSpots, isSaved, toggleSaved, recordRecent } = useSavedSpots();
  const { trustBySpotId, trustBoostBySpotId } = useSpotTrustScores(savedSpots);
  const [copilotVisible, setCopilotVisible] = useState(false);
  const {
    waypoints,
    saveWaypoint,
    deleteWaypoint,
    saving: savingWaypoint,
  } = useWaypoints();
  const { layers, radarTileUrl, radarLoading, radarError, toggleLayer, setLayers } =
    useMapLayers();
  const { isPro } = usePro();

  useEffect(() => {
    if (premiumLayersLoading || premiumMapLayersPro) return;
    setLayers((prev) => {
      if (!prev.radar && !prev.heatmap && !prev.community) return prev;
      return { ...prev, radar: false, heatmap: false, community: false };
    });
  }, [premiumMapLayersPro, premiumLayersLoading, setLayers]);

  const effectiveLayers = useMemo(() => {
    if (premiumMapLayersPro) return layers;
    return { ...layers, radar: false, heatmap: false, community: false };
  }, [layers, premiumMapLayersPro]);

  const viewportPersonalSpecies = useMemo(() => {
    if (!location) return [];
    return getPersonalSpeciesNear(location.latitude, location.longitude, 50);
  }, [location, getPersonalSpeciesNear]);

  const personalBoost = useMemo(() => {
    if (!isPersonalBiteEnabled() || !fingerprint.unlocked || !weather) return 0;
    const conditions = buildCatchConditions(weather);
    const { boost } = computePersonalBiteBoost(fingerprint, {
      hour: currentHour,
      conditions,
    });
    return boost;
  }, [fingerprint, weather, currentHour]);

  const {
    scoresBySpotId,
    topSpots: topDiscoverySpots,
    rankedDiscoverySpots,
    speciesBySpotId,
    communityBySpotId,
    isScoring: discoveryScoring,
    isEnriching: discoveryEnriching,
  } = useViewportSpotScores({
    spots: discoverySpots,
    weather: weather ?? null,
    tides: tidesData?.predictions ?? null,
    enabled: discoveryStatus === 'ready' && discoverySpots.length > 0,
    personalBoost,
    trustBoostBySpotId,
  });

  const heatmapStatus = useMemo(
    () => getBiteHeatmapStatus(discoverySpots, scoresBySpotId),
    [discoverySpots, scoresBySpotId]
  );

  const biteHeatmapGeoJson = useMemo(() => {
    if (!effectiveLayers.heatmap) return null;
    return buildBiteHeatmapGeoJson(discoverySpots, scoresBySpotId);
  }, [effectiveLayers.heatmap, discoverySpots, scoresBySpotId]);

  const handleToggleLayer = useCallback(
    (layer: keyof MapLayerState) => {
      const premiumLayers: (keyof MapLayerState)[] = ['radar', 'heatmap', 'community'];
      if (premiumLayers.includes(layer)) {
        if (premiumLayersLoading) return;
        if (!premiumMapLayersPro) {
          router.push(PRO_UPGRADE_HREF);
          return;
        }
      }
      toggleLayer(layer);
    },
    [toggleLayer, router, premiumMapLayersPro, premiumLayersLoading]
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [modalInitialValues, setModalInitialValues] = useState<Partial<LogCatchFormValues>>({});
  const [modalSpeciesOptions, setModalSpeciesOptions] = useState<string[] | undefined>(undefined);
  const { isDirty: formDirty, setDirty: setFormDirty } = useLogFormGuard();
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [selectedSpotSnapshot, setSelectedSpotSnapshot] = useState<NearbySpot | null>(null);
  const [speciesGuide, setSpeciesGuide] = useState<LocationSpeciesGuide | null>(null);

  const selectedSpot = useMemo(() => {
    if (!selectedSpotId) return null;
    return (
      discoverySpots.find((spot) => spot.id === selectedSpotId) ??
      selectedSpotSnapshot
    );
  }, [selectedSpotId, discoverySpots, selectedSpotSnapshot]);

  const fishingNowLatitude = selectedSpot?.latitude ?? location?.latitude ?? null;
  const fishingNowLongitude = selectedSpot?.longitude ?? location?.longitude ?? null;
  const { data: fishingWeather } = useWeather(fishingNowLatitude, fishingNowLongitude);
  const { data: fishingTidesData } = useTides(fishingNowLatitude, fishingNowLongitude);

  const copilotNearWater = useMemo(() => {
    if (!location) return false;
    return isNearWater(discoverySpots, location.latitude, location.longitude);
  }, [location, discoverySpots]);

  const copilotSpot = useMemo(() => {
    if (selectedSpot) return selectedSpot;
    if (!location) return null;
    return (
      findNearestWaterSpot(discoverySpots, location.latitude, location.longitude)?.spot ?? null
    );
  }, [selectedSpot, location, discoverySpots]);

  const copilotBiteLabel = useMemo(() => {
    if (!copilotSpot) return null;
    const score = scoresBySpotId[copilotSpot.id];
    return score ? `${score.activityRating}/5 · ${score.label}` : null;
  }, [copilotSpot, scoresBySpotId]);

  const showOnWaterCopilot =
    isOnWaterCopilotEnabled() && isPro && copilotNearWater && !modalVisible;

  // All viewport spots become map pins; keep the selected spot pinned even if
  // the user pans to a viewport that no longer contains it.
  const mapPinSpots = useMemo(() => {
    if (!selectedSpot) return discoverySpots;
    return discoverySpots.some((spot) => spot.id === selectedSpot.id)
      ? discoverySpots
      : [...discoverySpots, selectedSpot];
  }, [discoverySpots, selectedSpot]);

  const {
    data: spotDetails,
    isLoading: spotDetailsLoading,
    isError: spotDetailsError,
    refetch: refetchSpotDetails,
  } = useSpotDetails({
    spotId: selectedSpotId,
    latitude: selectedSpot?.latitude,
    longitude: selectedSpot?.longitude,
  });

  const spotPersonalSpecies = useMemo(() => {
    if (!selectedSpot) return [];
    return getPersonalSpeciesNear(selectedSpot.latitude, selectedSpot.longitude);
  }, [selectedSpot, getPersonalSpeciesNear]);

  const {
    data: speciesPredictionData,
    catchActivity,
    isLoading: speciesPredictionsLoading,
    isUpdating: speciesPredictionsUpdating,
    isError: speciesPredictionsError,
    isCatchActivityError,
    refetch: refetchSpeciesPredictions,
    refetchCatchActivity,
  } = useSpeciesPrediction({
    locationId: selectedSpotId,
    latitude: selectedSpot?.latitude ?? location?.latitude,
    longitude: selectedSpot?.longitude ?? location?.longitude,
    spotName: selectedSpot?.name ?? null,
    spotWaterType: selectedSpot?.water_type ?? null,
    personalSpecies: spotPersonalSpecies,
    tidesPredictions: fishingTidesData?.predictions ?? null,
  });

  const personalCatchTimes = useMemo(() => {
    const lat = selectedSpot?.latitude ?? location?.latitude;
    const lon = selectedSpot?.longitude ?? location?.longitude;
    if (lat == null || lon == null) return [];
    return getPersonalCatchTimesNear(lat, lon).slice(0, 3);
  }, [
    selectedSpot?.latitude,
    selectedSpot?.longitude,
    location?.latitude,
    location?.longitude,
    getPersonalCatchTimesNear,
  ]);

  const spotPersonalCatchTimes = useMemo(() => {
    if (!selectedSpot) return [];
    return getPersonalCatchTimesNear(selectedSpot.latitude, selectedSpot.longitude);
  }, [selectedSpot, getPersonalCatchTimesNear]);

  const areaRegulationNotices = useMemo(() => {
    if (!location) return [];
    return getAreaRegulationNotices(location.latitude, location.longitude);
  }, [location]);

  const communityCatchSummary = useMemo(
    () => summarizeCommunityCatchActivity(catchActivity),
    [catchActivity]
  );

  const speciesCoachAdvice = useMemo((): CatchCoachAdvice | null => {
    if (!speciesGuide || !selectedSpot) return null;
    const spotBestTime = getBestTimeNow({
      latitude: selectedSpot.latitude,
      longitude: selectedSpot.longitude,
      weather: fishingWeather ?? null,
      spotCatchTimes: spotDetails?.bestCatchTimes,
      personalCatchTimes: spotPersonalCatchTimes,
      tides: fishingTidesData?.predictions ?? null,
      spotSpecies: speciesPredictionData?.predictions,
      communityCatchActivity: catchActivity,
    });
    return buildCatchCoachAdvice({
      speciesName: speciesGuide.species.name,
      guide: speciesGuide,
      prediction: speciesGuide.prediction,
      bestTime: spotBestTime,
      communityRows: catchActivity,
      catches,
      latitude: selectedSpot.latitude,
      longitude: selectedSpot.longitude,
    });
  }, [
    speciesGuide,
    selectedSpot,
    fishingWeather,
    spotDetails?.bestCatchTimes,
    spotPersonalCatchTimes,
    fishingTidesData?.predictions,
    speciesPredictionData?.predictions,
    catchActivity,
    catches,
  ]);

  const bestTimeAsOf = useMemo(() => {
    void currentHour;
    return new Date();
  }, [currentHour]);

  const bestTime = useMemo(
    () =>
      getBestTimeNow({
        latitude: fishingNowLatitude,
        longitude: fishingNowLongitude,
        weather: fishingWeather ?? null,
        date: bestTimeAsOf,
        spotCatchTimes: spotDetails?.bestCatchTimes,
        personalCatchTimes: selectedSpot ? spotPersonalCatchTimes : personalCatchTimes,
        tides: fishingTidesData?.predictions ?? null,
        spotSpecies: speciesPredictionData?.predictions,
        communityCatchActivity: catchActivity,
      }),
    [
      fishingNowLatitude,
      fishingNowLongitude,
      fishingWeather,
      bestTimeAsOf,
      spotDetails?.bestCatchTimes,
      selectedSpot,
      spotPersonalCatchTimes,
      personalCatchTimes,
      fishingTidesData?.predictions,
      speciesPredictionData?.predictions,
      catchActivity,
    ]
  );

  const modalCoachContext = useMemo((): CatchCoachContext | undefined => {
    if (!selectedSpot) return undefined;
    return {
      bestTime,
      communityRows: catchActivity,
      spot: selectedSpot,
    };
  }, [selectedSpot, bestTime, catchActivity]);

  const saveCatchMutation = useSaveCatch();
  const syncCatchesMutation = useSyncCatches();
  const saving = saveCatchMutation.isPending;
  const { showToast } = useToast();
  const loading = gpsLoading && activeCoords === null;

  const handleMapPress = useCallback(() => {
    recentMapTapRef.current = true;
    if (mapTapResetTimerRef.current) clearTimeout(mapTapResetTimerRef.current);
    mapTapResetTimerRef.current = setTimeout(() => {
      recentMapTapRef.current = false;
    }, 500);
    searchBarRef.current?.dismiss();
  }, []);

  const handleMapLongPress = useCallback((coords: MapLongPressCoords) => {
    if (recentMapTapRef.current) return;
    hapticLight();
    setPendingWaypointCoords(coords);
    setWaypointModalVisible(true);
  }, []);

  const handleSaveWaypoint = useCallback(
    async (values: { name: string; notes: string }) => {
      if (!pendingWaypointCoords) return;
      const waypointLimit = getMaxWaypoints(isPro);
      if (waypoints.length >= waypointLimit) {
        hapticWarning();
        showToast({
          message: `Waypoint limit reached (${waypointLimit})`,
          variant: 'warning',
          actionLabel: isPro ? undefined : 'Upgrade',
          onAction: isPro ? undefined : () => router.push(PRO_UPGRADE_HREF),
        });
        return;
      }
      try {
        await saveWaypoint({
          name: values.name.trim() || 'My spot',
          notes: values.notes.trim(),
          latitude: pendingWaypointCoords.latitude,
          longitude: pendingWaypointCoords.longitude,
        });
        hapticSuccess();
        showToast({ message: 'Private waypoint saved', variant: 'success' });
        setWaypointModalVisible(false);
        setPendingWaypointCoords(null);
      } catch (error) {
        if (__DEV__) console.warn('[waypoints] save failed:', error);
        hapticError();
        showToast({ message: 'Could not save waypoint', variant: 'error' });
      }
    },
    [pendingWaypointCoords, saveWaypoint, showToast, waypoints.length, isPro, router]
  );

  const handleWaypointPress = useCallback((waypoint: WaypointRecord) => {
    hapticLight();
    setFlyToTarget({
      lat: waypoint.latitude,
      lng: waypoint.longitude,
      key: Date.now(),
      zoom: 15,
    });
    sheetRef.current?.snapToIndex(0);
  }, []);

  const handleDeleteWaypoint = useCallback(
    async (waypointId: string) => {
      try {
        await deleteWaypoint(waypointId);
        hapticLight();
      } catch (error) {
        if (__DEV__) console.warn('[waypoints] delete failed:', error);
        showToast({ message: 'Could not delete waypoint', variant: 'error' });
      }
    },
    [deleteWaypoint, showToast]
  );

  const handleSpotPress = useCallback((spot: NearbySpot) => {
    hapticLight();
    recordRecent(spot);
    prefetchSpotData(queryClient, spot);
    setSelectedSpotId(spot.id);
    setSelectedSpotSnapshot(spot);
    setFlyToTarget({
      lat: spot.latitude,
      lng: spot.longitude,
      key: Date.now(),
      zoom: 14,
    });
    sheetRef.current?.snapToIndex(2);
  }, [recordRecent]);

  const handleSavedSpotPress = useCallback(
    (snapshot: SavedSpotSnapshot) => {
      const origin = activeCoords ?? deviceLocation;
      const distance =
        origin != null
          ? calculateDistance(
              origin.latitude,
              origin.longitude,
              snapshot.latitude,
              snapshot.longitude
            )
          : 0;
      handleSpotPress(savedSpotToNearbySpot(snapshot, distance));
    },
    [activeCoords, deviceLocation, handleSpotPress]
  );

  const handleGoToBestSpot = useCallback(
    (spot: NearbySpot) => {
      hapticLight();
      handleSpotPress(spot);
    },
    [handleSpotPress]
  );

  const handleClearSelection = useCallback(() => {
    setSelectedSpotId(null);
    setSelectedSpotSnapshot(null);
  }, []);

  const heroCollapseLevel: HeroCollapseLevel = useMemo(() => {
    if (searchFocused) return 'compact';
    if (sheetIndex >= 1) return 'minimal';
    return 'full';
  }, [searchFocused, sheetIndex]);

  const effectiveHeaderHeight = useMemo(
    () =>
      Math.max(
        heroHeaderHeight,
        estimateHeroHeaderHeight(heroCollapseLevel, insets.top)
      ),
    [heroHeaderHeight, heroCollapseLevel, insets.top]
  );

  const showMapLegend = showLegend && sheetIndex === 0 && !searchFocused && !isWide;
  const legendTopOffset = effectiveHeaderHeight + Spacing.xs;
  const sheetHeaderInset = isWide ? 0 : effectiveHeaderHeight + Spacing.md;
  const bannerTopOffset = isWide
    ? 110
    : effectiveHeaderHeight +
      (showMapLegend ? MAP_LEGEND_ESTIMATED_HEIGHT + Spacing.sm : Spacing.xs);

  const handleSheetIndexChange = useCallback(
    (index: number) => {
      setSheetIndex(index);
      if (isWide) {
        setFabBottomOffset(Spacing.lg);
        return;
      }
      setFabBottomOffset(
        getSheetHeightForIndex(index, windowHeight, sheetHeaderInset) || BOTTOM_SHEET_PEEK_HEIGHT
      );
    },
    [windowHeight, isWide, sheetHeaderInset]
  );

  const handleHeroHeaderLayout = useCallback((height: number) => {
    setHeroHeaderHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
  }, []);

  useEffect(() => {
    if (isWide) {
      setFabBottomOffset(Spacing.lg);
    }
  }, [isWide]);

  useEffect(() => {
    if (searchFocused && !isWide) {
      sheetRef.current?.snapToIndex(0);
    }
  }, [searchFocused, isWide]);

  const handleOpenModal = useCallback((
    initialValues: Partial<LogCatchFormValues> = {},
    speciesOptions?: string[]
  ) => {
    setModalInitialValues(initialValues);
    setModalSpeciesOptions(speciesOptions);
    setFormKey((k) => k + 1);
    setFormDirty(false);
    setModalVisible(true);
  }, [setFormDirty]);

  const resetModalForm = useCallback(() => {
    setModalInitialValues({});
    setModalSpeciesOptions(undefined);
    setFormKey((k) => k + 1);
    setFormDirty(false);
  }, [setFormDirty]);

  useLogFormGuardDiscard(() => {
    if (modalVisible) {
      setModalVisible(false);
      resetModalForm();
    }
  });

  const logCatchLocation = useMemo(
    () => resolveCatchLocationFromMap(selectedSpot, activeCoords),
    [selectedSpot, activeCoords]
  );

  const handleSaveCatch = (values: LogCatchFormValues) => {
    const selectedSpeciesData = speciesData.find((s) => s.name === values.species);
    saveCatchMutation.mutate(
      {
        species: values.species,
        speciesId: selectedSpeciesData?.id || '',
        weight: values.weight,
        length: values.length,
        lure: values.lure,
        notes: values.notes,
        photoUri: values.photoUri,
        conditions: buildCatchConditions(fishingWeather ?? weather, { tideNote: bestTime.tideNote }),
        latitude: logCatchLocation.latitude,
        longitude: logCatchLocation.longitude,
        locationName: logCatchLocation.locationName,
        caughtAt: values.caughtAt,
        date: new Date(values.caughtAt).toLocaleDateString(),
        sharedAnonymously: values.sharedAnonymously,
      },
      {
        onSuccess: (result) => {
          setModalVisible(false);
          resetModalForm();
          showCatchSavedFeedback({
            result,
            showToast,
            router,
            isOnline: !isOffline,
            cloudSyncEnabled: isCloudSyncEnabled(),
            onRetrySync: () => syncCatchesMutation.mutate(),
            onSuccessHaptic: hapticSuccess,
            onWarningHaptic: hapticWarning,
          });
        },
        onError: (error) => {
          if (__DEV__) console.error('Save catch error:', error);
          hapticError();
          showToast({ message: 'Failed to save catch. Please try again.', variant: 'error' });
        },
      }
    );
  };

  const closeModal = () => {
    confirmDiscardUnsavedChanges({
      isDirty: formDirty,
      onDiscard: () => {
        setModalVisible(false);
        resetModalForm();
      },
    });
  };

  const useRecommendation = (rec: RecommendedSpecies) => {
    handleOpenModal({ species: rec.name, lure: rec.recommendedLure });
  };

  const openLogForSpotSpecies = useCallback((
    spot: NearbySpot,
    speciesName?: string,
    coachAdvice?: CatchCoachAdvice
  ) => {
    const spotSpeciesNames =
      spot.id === selectedSpotId
        ? getSpotLogSpeciesOptions(
            speciesPredictionData?.predictions ?? [],
            speciesPredictionData?.species ?? []
          )
        : [];

    const targetSpecies = speciesName ?? spotSpeciesNames[0] ?? '';

    const speciesInfo = targetSpecies
      ? speciesData.find((s) => s.name === targetSpecies)
      : undefined;
    const lure =
      coachAdvice?.setup.lureLabel ??
      (speciesInfo && getPrimaryLureLabel(speciesInfo.id)) ??
      (speciesInfo && speciesInfo.lures.length > 0 ? speciesInfo.lures[0] : '') ??
      '';

    const coachNotes = [coachAdvice?.setup.tip, coachAdvice?.technique]
      .filter(Boolean)
      .join(' ');

    handleOpenModal(
      {
        species: targetSpecies,
        lure,
        notes: coachNotes || undefined,
      },
      spotSpeciesNames.length > 0 ? spotSpeciesNames : undefined
    );
    setSpeciesGuide(null);
  }, [selectedSpotId, speciesPredictionData, handleOpenModal]);

  const handleSpeciesPress = useCallback(
    (species: AvailableSpecies, prediction?: SpeciesPrediction) => {
      if (!selectedSpot) return;
      setSpeciesGuide(
        buildLocationSpeciesGuide({
          species,
          prediction,
          spot: selectedSpot,
          bestCatchTimes: spotDetails?.bestCatchTimes ?? [],
        })
      );
    },
    [selectedSpot, spotDetails?.bestCatchTimes]
  );

  const handleLogFromGuide = useCallback(
    (speciesName: string, advice?: CatchCoachAdvice) => {
      if (!selectedSpot) return;
      openLogForSpotSpecies(selectedSpot, speciesName, advice);
    },
    [selectedSpot, openLogForSpotSpecies]
  );

  const handleRetryPredictions = useCallback(() => {
    void refetchSpeciesPredictions();
  }, [refetchSpeciesPredictions]);

  const handleRetryCatchTimes = useCallback(() => {
    void refetchSpotDetails();
  }, [refetchSpotDetails]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <BrandMark size="lg" showTagline />
          <ActivityIndicator color={colors.brandAccent} size="large" />
          <Text style={styles.loadingText}>Loading map…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {mapCameraAnchor && (
        <View style={styles.mapScreen}>
          <View style={[styles.mapColumn, isWide && { marginRight: mapPanelWidth }]}>
            <FishingMap
            latitude={mapCameraAnchor.latitude}
            longitude={mapCameraAnchor.longitude}
            userLatitude={userMarkerLocation?.latitude}
            userLongitude={userMarkerLocation?.longitude}
            nearbySpots={mapPinSpots}
            spotScores={scoresBySpotId}
            onSpotPress={handleSpotPress}
            onRegionChange={onViewportChange}
            recenterOnLocationChange={activeCoords?.source !== 'search'}
            centerRequestKey={mapCenterKey}
            selectedSpotId={selectedSpotId}
            flyToTarget={flyToTarget}
            onMapPress={handleMapPress}
            showLegend={showMapLegend}
            legendTopOffset={legendTopOffset}
            waypoints={waypoints}
            onWaypointPress={handleWaypointPress}
            onMapLongPress={handleMapLongPress}
            mapLayers={effectiveLayers}
            radarTileUrl={radarTileUrl}
            biteHeatmapGeoJson={biteHeatmapGeoJson}
          />

          {!isWide ? (
            <AppScreenHeader
              variant="hero"
              collapseLevel={heroCollapseLevel}
              onLayout={handleHeroHeaderLayout}
            >
              <MapLocationSearchBar
                ref={searchBarRef}
                onSelectLocation={handleSelectSearchLocation}
                embedded
                onFocusChange={setSearchFocused}
              />
            </AppScreenHeader>
          ) : (
            <MapLocationSearchBar
              ref={searchBarRef}
              onSelectLocation={handleSelectSearchLocation}
              onFocusChange={setSearchFocused}
            />
          )}

          <MapOverlayControls
            onRecenter={handleRecenterOnGps}
            recenterDisabled={gpsLoading}
            showLegend={showLegend}
            onToggleLegend={() => setShowLegend((prev) => !prev)}
            onLayersPress={() => setLayerSheetVisible(true)}
            onCopilotPress={() => setCopilotVisible(true)}
            showCopilot={showOnWaterCopilot}
            mapLayersActive={
              effectiveLayers.depth ||
              effectiveLayers.radar ||
              effectiveLayers.heatmap ||
              effectiveLayers.community
            }
            bottomOffset={fabBottomOffset}
          />

          {(permissionDenied && !isSearchingLocation) || isSearchingLocation ? (
            <View
              style={[
                styles.bannerContainer,
                { top: bannerTopOffset },
              ]}
              pointerEvents="box-none"
            >
              {permissionDenied && !isSearchingLocation && (
                <View style={styles.locationBanner}>
                  <Info color={colors.textSecondary} size={14} />
                  <Text style={styles.bannerText}>
                    Enable location for GPS-accurate species and map centering.
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
              {isSearchingLocation && activeCoords?.label && !selectedSpot && (
                <View style={styles.searchBanner}>
                  <MapPin color={colors.brandAccent} size={14} />
                  <Text style={styles.bannerText}>Viewing {activeCoords.label}</Text>
                </View>
              )}
            </View>
          ) : null}
          </View>

          <MapBottomSheet
            ref={sheetRef}
            panelMode={isWide}
            panelWidth={mapPanelWidth}
            species={localSpecies}
            speciesLoading={speciesLoading || (gpsLoading && !activeCoords)}
            speciesFetching={isFetchingSpecies}
            isOffline={isOffline}
            permissionDenied={permissionDenied && !isSearchingLocation}
            radiusMeters={DEFAULT_RADIUS_METERS}
            coordinateSource={activeCoords?.source ?? 'gps'}
            locationLabel={activeCoords?.label}
            onRetrySpecies={refetchSpecies}
            selectedSpot={selectedSpot}
            spotDetails={spotDetails ?? null}
            spotDetailsLoading={spotDetailsLoading}
            spotDetailsError={spotDetailsError}
            speciesPredictions={speciesPredictionData?.predictions ?? []}
            availableSpecies={speciesPredictionData?.species ?? []}
            speciesPredictionsLoading={speciesPredictionsLoading}
            speciesPredictionsUpdating={speciesPredictionsUpdating}
            speciesPredictionsError={speciesPredictionsError}
            speciesSkyCondition={speciesPredictionData?.skyCondition ?? null}
            speciesTemperatureF={speciesPredictionData?.temperatureF ?? null}
            speciesContextSubtitle={speciesPredictionData?.contextSubtitle ?? null}
            onSheetIndexChange={handleSheetIndexChange}
            bestTime={bestTime}
            weather={weather ?? null}
            tides={tidesData?.predictions ?? null}
            fishingWeather={fishingWeather ?? null}
            fishingTides={fishingTidesData?.predictions ?? null}
            recommendations={recommendations}
            categorizedSpots={categorizedSpots}
            discoveryStatus={discoveryStatus}
            usingCachedDiscovery={usingCachedDiscovery}
            offlineMap={offlineMap}
            onSpotPress={handleSpotPress}
            onClearSelection={handleClearSelection}
            selectedSpotId={selectedSpotId}
            onUseRecommendation={useRecommendation}
            onLogSpotFish={openLogForSpotSpecies}
            onLogCatch={(spot, speciesName) => openLogForSpotSpecies(spot, speciesName)}
            onSpeciesPress={handleSpeciesPress}
            personalCatchTimes={spotPersonalCatchTimes}
            onRetryPredictions={handleRetryPredictions}
            onRetryCatchTimes={handleRetryCatchTimes}
            insights={insights}
            fingerprint={fingerprint}
            onViewInsights={() => router.push('/history')}
            areaRegulationNotices={areaRegulationNotices}
            personalSpeciesNear={spotPersonalSpecies}
            scoresBySpotId={scoresBySpotId}
            topDiscoverySpots={topDiscoverySpots}
            rankedDiscoverySpots={rankedDiscoverySpots}
            speciesBySpotId={speciesBySpotId}
            viewportPersonalSpecies={viewportPersonalSpecies}
            discoveryScoring={discoveryScoring}
            discoveryEnriching={discoveryEnriching}
            onGoToBestSpot={handleGoToBestSpot}
            onPlanTrip={() => {
              if (!tripPlannerEnabled) {
                router.push(PRO_UPGRADE_HREF);
                return;
              }
              const lat = location?.latitude;
              const lng = location?.longitude;
              router.push({
                pathname: '/trip-planner',
                params: {
                  ...(lat != null ? { lat: String(lat) } : {}),
                  ...(lng != null ? { lng: String(lng) } : {}),
                },
              });
            }}
            savedSpots={savedSpots}
            recentSpots={recentSpots}
            isSpotSaved={isSaved}
            onToggleSpotSaved={toggleSaved}
            onSavedSpotPress={handleSavedSpotPress}
            headerInset={sheetHeaderInset}
            communityCatchSummary={communityCatchSummary}
            communityCatchLoading={speciesPredictionsLoading && selectedSpot != null}
            communityCatchError={isCatchActivityError && selectedSpot != null}
            onCommunityCatchRetry={refetchCatchActivity}
            waypoints={waypoints}
            onWaypointPress={handleWaypointPress}
            onDeleteWaypoint={handleDeleteWaypoint}
            catches={catches}
            communityBySpotId={communityBySpotId}
            discoverySpots={discoverySpots}
            trustBySpotId={trustBySpotId}
          />
        </View>
      )}

      <OnWaterCopilotSheet
        visible={copilotVisible}
        onClose={() => setCopilotVisible(false)}
        context={{
          spot: copilotSpot,
          weather: fishingWeather ?? weather ?? null,
          speciesName: copilotSpot ? scoresBySpotId[copilotSpot.id]?.topSpeciesHint ?? null : null,
          biteLabel: copilotBiteLabel,
        }}
      />

      <SpeciesGuideSheet
        guide={speciesGuide}
        spotName={selectedSpot?.name}
        coachAdvice={speciesCoachAdvice}
        onClose={() => setSpeciesGuide(null)}
        onLogFish={selectedSpot ? handleLogFromGuide : undefined}
      />

      <MapLayerSheet
        visible={layerSheetVisible}
        layers={effectiveLayers}
        radarLoading={radarLoading}
        radarError={radarError}
        heatmapStatus={heatmapStatus}
        onToggle={handleToggleLayer}
        onClose={() => setLayerSheetVisible(false)}
      />

      <WaypointSaveModal
        visible={waypointModalVisible}
        latitude={pendingWaypointCoords?.latitude ?? null}
        longitude={pendingWaypointCoords?.longitude ?? null}
        saving={savingWaypoint}
        onSave={handleSaveWaypoint}
        onClose={() => {
          setWaypointModalVisible(false);
          setPendingWaypointCoords(null);
        }}
      />

      <TouchableOpacity
        style={[styles.fab, { bottom: fabBottomOffset + Spacing.md }]}
        onPress={() => handleOpenModal()}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Log a catch"
      >
        <Fish color={colors.brandAccentForeground} size={24} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalOverlay, isWide && styles.modalOverlayWide]}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeModal} />
          <View
            style={[
              styles.modalContainer,
              isWide && {
                maxWidth: modalMaxWidth,
                borderRadius: BorderRadius.xl,
                maxHeight: '90%',
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Your Catch</Text>
              <TouchableOpacity
                onPress={closeModal}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Close log catch form"
              >
                <X color={colors.text} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <LogCatchForm
                key={formKey}
                initialValues={modalInitialValues}
                location={logCatchLocation}
                speciesOptions={modalSpeciesOptions}
                speciesOptionsHint="Based on species documented or predicted for this spot."
                coachContext={modalCoachContext}
                onSubmit={handleSaveCatch}
                saving={saving}
                onDirtyChange={setFormDirty}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    mapScreen: {
      flex: 1,
      position: 'relative',
    },
    mapColumn: {
      flex: 1,
      position: 'relative',
    },
    bannerContainer: {
      position: 'absolute',
      left: Spacing.sm,
      right: Spacing.sm,
      zIndex: 12,
      gap: Spacing.xs,
    },
    locationBanner: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.sm,
      backgroundColor: colors.surfaceElevated,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.sm,
      backgroundColor: colors.surfaceElevated,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.brandAccent,
    },
    bannerText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
    },
    settingsButton: {
      backgroundColor: colors.brandAccent,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
    },
    settingsButtonText: {
      color: colors.brandAccentForeground,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.semibold,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: Spacing.md,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: FontSizes.md,
    },
    fab: {
      position: 'absolute',
      left: Spacing.lg,
      backgroundColor: colors.brandAccent,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.brandNavy,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
      zIndex: 16,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalOverlayWide: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.lg,
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    modalContainer: {
      backgroundColor: colors.card,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      maxHeight: '85%',
      padding: Spacing.lg,
      width: '100%',
      zIndex: 1,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    modalTitle: {
      color: colors.text,
      fontSize: FontSizes.xxl,
      fontWeight: FontWeights.bold,
    },
  });
}
