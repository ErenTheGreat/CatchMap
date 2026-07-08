import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
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
} from '@/utils/recommendations';
import { getBestTimeNow } from '@/utils/bestTimeNow';
import { buildLocationSpeciesGuide } from '@/utils/speciesGuide';
import { getPrimaryLureLabel } from '@/utils/speciesRigs';
import speciesData from '@/data/species.json';
import FishingMap from '@/components/FishingMap';
import MapBottomSheet, { type MapBottomSheetHandle } from '@/components/map/MapBottomSheet';
import SpeciesGuideSheet from '@/components/map/SpeciesGuideSheet';
import MapLocationSearchBar, {
  type MapLocationSearchBarHandle,
} from '@/components/map/MapLocationSearchBar';
import MapOverlayControls from '@/components/map/MapOverlayControls';
import { BOTTOM_SHEET_PEEK_HEIGHT, getSheetHeightForIndex } from '@/components/map/mapSheetConstants';
import type { FlyToTarget } from '@/components/map/types';
import { useDeviceLocation } from '@/hooks/useDeviceLocation';
import { useLocalFishingData } from '@/hooks/useLocalFishingData';
import { useNetworkStatus } from '@/providers/NetworkProvider';
import { DEFAULT_RADIUS_METERS } from '@/lib/api/endpoints/localSpecies';
import type { ActiveCoordinates, LocationSearchResult } from '@/lib/types/mapCoordinates';
import { useCategorizedSpots } from '@/hooks/useCategorizedSpots';
import type { DiscoveryDashboardStatus } from '@/components/map/DiscoveryDashboard';
import { useOfflineMap } from '@/hooks/useOfflineMap';
import { useSaveCatch } from '@/hooks/useCatches';
import { useCatchInsights } from '@/hooks/useCatchInsights';
import { getAreaRegulationNotices } from '@/utils/fishingRegulations';
import { useWeather } from '@/hooks/useWeather';
import { useTides } from '@/hooks/useTides';
import { useSpotDetails } from '@/hooks/useSpotDetails';
import { useSpeciesPrediction } from '@/hooks/useSpeciesPrediction';
import { getSpotLogSpeciesOptions } from '@/lib/species/spotLogSpecies';
import { prefetchSpotData } from '@/lib/species/prefetchSpotData';
import { queryClient } from '@/lib/queryClient';
import { searchResultToNearbySpot } from '@/lib/api/endpoints/locationsSearch';
import type { LocationSpeciesGuide } from '@/lib/types/speciesGuide';
import type { AvailableSpecies, SpeciesPrediction } from '@/lib/types/speciesPrediction';
import LogCatchForm, { type LogCatchFormValues } from '@/components/catch/LogCatchForm';
import { resolveCatchLocationFromMap } from '@/utils/catchLocation';
import { buildCatchConditions } from '@/utils/catchConditions';
import { useToast } from '@/components/ui';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useTheme } from '@/providers/ThemeProvider';
import { hapticLight, hapticSuccess, hapticWarning, hapticError } from '@/utils/haptics';

export default function MapScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { lat: flyLatParam, lng: flyLngParam } = useLocalSearchParams<{
    lat?: string;
    lng?: string;
  }>();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isWide, mapPanelWidth, modalMaxWidth } = useResponsiveLayout();
  const sheetRef = useRef<MapBottomSheetHandle>(null);
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

  const location = activeCoords
    ? { latitude: activeCoords.latitude, longitude: activeCoords.longitude }
    : null;

  const permissionDenied = deviceLocation?.permissionDenied ?? false;
  const isSearchingLocation = activeCoords?.source === 'search';

  const handleSelectSearchLocation = useCallback((result: LocationSearchResult) => {
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
    setMapCenterKey((key) => key + 1);
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
  } = useCategorizedSpots(location?.latitude, location?.longitude);

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

  const offlineMap = useOfflineMap(location?.latitude, location?.longitude);
  const { data: weather } = useWeather(location?.latitude, location?.longitude);
  const { data: tidesData } = useTides(location?.latitude, location?.longitude);
  const { getPersonalCatchTimesNear, getPersonalSpeciesNear, insights } = useCatchInsights();

  const [modalVisible, setModalVisible] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [modalInitialValues, setModalInitialValues] = useState<Partial<LogCatchFormValues>>({});
  const [modalSpeciesOptions, setModalSpeciesOptions] = useState<string[] | undefined>(undefined);
  const [formDirty, setFormDirty] = useState(false);
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
    isLoading: speciesPredictionsLoading,
    isUpdating: speciesPredictionsUpdating,
    isError: speciesPredictionsError,
    refetch: refetchSpeciesPredictions,
  } = useSpeciesPrediction({
    locationId: selectedSpotId,
    latitude: selectedSpot?.latitude ?? location?.latitude,
    longitude: selectedSpot?.longitude ?? location?.longitude,
    spotName: selectedSpot?.name ?? null,
    spotWaterType: selectedSpot?.water_type ?? null,
    personalSpecies: spotPersonalSpecies,
    tidesPredictions: tidesData?.predictions ?? null,
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
  }, [location?.latitude, location?.longitude]);

  const bestTime = useMemo(
    () =>
      getBestTimeNow({
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        weather: weather ?? null,
        spotCatchTimes: spotDetails?.bestCatchTimes,
        personalCatchTimes,
        tides: tidesData?.predictions ?? null,
        spotSpecies: speciesPredictionData?.predictions,
      }),
    [
      location?.latitude,
      location?.longitude,
      weather,
      spotDetails?.bestCatchTimes,
      personalCatchTimes,
      tidesData?.predictions,
      speciesPredictionData?.predictions,
      timeTick,
    ]
  );

  const saveCatchMutation = useSaveCatch();
  const saving = saveCatchMutation.isPending;
  const { showToast } = useToast();
  const loading = gpsLoading && activeCoords === null;

  const handleMapPress = useCallback(() => {
    searchBarRef.current?.dismiss();
  }, []);

  const handleSpotPress = useCallback((spot: NearbySpot) => {
    hapticLight();
    prefetchSpotData(queryClient, spot);
    setSelectedSpotId(spot.id);
    setSelectedSpotSnapshot(spot);
    setFlyToTarget({
      lat: spot.latitude,
      lng: spot.longitude,
      key: Date.now(),
      zoom: 14,
    });
    sheetRef.current?.snapToIndex(1);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedSpotId(null);
    setSelectedSpotSnapshot(null);
  }, []);

  const handleSheetIndexChange = useCallback(
    (index: number) => {
      setSheetIndex(index);
      if (isWide) {
        setFabBottomOffset(Spacing.lg);
        return;
      }
      setFabBottomOffset(getSheetHeightForIndex(index, windowHeight) || BOTTOM_SHEET_PEEK_HEIGHT);
    },
    [windowHeight, isWide]
  );

  const heroCollapseLevel: HeroCollapseLevel = useMemo(() => {
    if (searchFocused) return 'compact';
    if (sheetIndex >= 1) return 'minimal';
    return 'full';
  }, [searchFocused, sheetIndex]);

  const handleHeroHeaderLayout = useCallback((height: number) => {
    setHeroHeaderHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
  }, []);

  useEffect(() => {
    if (isWide) {
      setFabBottomOffset(Spacing.lg);
    }
  }, [isWide]);

  const handleOpenModal = (
    initialValues: Partial<LogCatchFormValues> = {},
    speciesOptions?: string[]
  ) => {
    setModalInitialValues(initialValues);
    setModalSpeciesOptions(speciesOptions);
    setFormKey((k) => k + 1);
    setFormDirty(false);
    setModalVisible(true);
  };

  const resetModalForm = () => {
    setModalInitialValues({});
    setModalSpeciesOptions(undefined);
    setFormKey((k) => k + 1);
    setFormDirty(false);
  };

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
        conditions: buildCatchConditions(weather, { tideNote: bestTime.tideNote }),
        latitude: logCatchLocation.latitude,
        longitude: logCatchLocation.longitude,
        locationName: logCatchLocation.locationName,
        caughtAt: values.caughtAt,
        date: new Date(values.caughtAt).toLocaleDateString(),
      },
      {
        onSuccess: (result) => {
          setModalVisible(false);
          resetModalForm();
          if (result.synced) {
            hapticSuccess();
            showToast({
              message: 'Your catch has been logged!',
              variant: 'success',
              actionLabel: 'View in History',
              onAction: () => router.push('/history'),
            });
          } else {
            hapticWarning();
            showToast({
              message: 'Saved on this device — will sync when online',
              variant: 'warning',
              actionLabel: 'View in History',
              onAction: () => router.push('/history'),
            });
          }
        },
        onError: (error) => {
          console.error('Save catch error:', error);
          hapticError();
          showToast({ message: 'Failed to save catch. Please try again.', variant: 'error' });
        },
      }
    );
  };

  const closeModal = () => {
    if (formDirty) {
      Alert.alert('Discard changes?', 'You have unsaved changes. Discard them?', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setModalVisible(false);
            resetModalForm();
          },
        },
      ]);
      return;
    }
    setModalVisible(false);
    resetModalForm();
  };

  const useRecommendation = (rec: RecommendedSpecies) => {
    handleOpenModal({ species: rec.name, lure: rec.recommendedLure });
  };

  const useSpotSpecies = (spot: NearbySpot, speciesName?: string) => {
    const spotSpeciesNames =
      spot.id === selectedSpotId
        ? getSpotLogSpeciesOptions(
            speciesPredictionData?.predictions ?? [],
            speciesPredictionData?.species ?? []
          )
        : getSpotLogSpeciesOptions(
            spot.matchedSpecies.map((name) => ({ name })),
            spot.matchedSpecies.map((name) => ({ name }))
          );

    const targetSpecies =
      speciesName ??
      spotSpeciesNames[0] ??
      (spot.matchedSpecies.length > 0 ? spot.matchedSpecies[0] : '');

    const speciesInfo = targetSpecies
      ? speciesData.find((s) => s.name === targetSpecies)
      : undefined;
    const lure =
      (speciesInfo && getPrimaryLureLabel(speciesInfo.id)) ??
      (speciesInfo && speciesInfo.lures.length > 0 ? speciesInfo.lures[0] : '') ??
      '';

    handleOpenModal(
      {
        species: targetSpecies,
        lure,
      },
      spotSpeciesNames.length > 0 ? spotSpeciesNames : undefined
    );
    setSpeciesGuide(null);
  };

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
    (speciesName: string) => {
      if (!selectedSpot) return;
      useSpotSpecies(selectedSpot, speciesName);
    },
    [selectedSpot]
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
      {location && (
        <View style={styles.mapScreen}>
          <View style={[styles.mapColumn, isWide && { marginRight: mapPanelWidth }]}>
            <FishingMap
            latitude={location.latitude}
            longitude={location.longitude}
            nearbySpots={mapPinSpots}
            onSpotPress={handleSpotPress}
            onRegionChange={onViewportChange}
            recenterOnLocationChange
            centerRequestKey={mapCenterKey}
            selectedSpotId={selectedSpotId}
            flyToTarget={flyToTarget}
            onMapPress={handleMapPress}
            showLegend={showLegend}
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
            bottomOffset={fabBottomOffset}
          />

          {(permissionDenied && !isSearchingLocation) || isSearchingLocation ? (
            <View
              style={[
                styles.bannerContainer,
                { top: isWide ? 110 : heroHeaderHeight + Spacing.xs },
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
            recommendations={recommendations}
            categorizedSpots={categorizedSpots}
            discoveryStatus={discoveryStatus}
            usingCachedDiscovery={usingCachedDiscovery}
            offlineMap={offlineMap}
            onSpotPress={handleSpotPress}
            onClearSelection={handleClearSelection}
            selectedSpotId={selectedSpotId}
            onUseRecommendation={useRecommendation}
            onLogSpotFish={useSpotSpecies}
            onSpeciesPress={handleSpeciesPress}
            personalCatchTimes={spotPersonalCatchTimes}
            onRetryPredictions={handleRetryPredictions}
            onRetryCatchTimes={handleRetryCatchTimes}
            insights={insights}
            onViewInsights={() => router.push('/history')}
            areaRegulationNotices={areaRegulationNotices}
            personalSpeciesNear={spotPersonalSpecies}
          />
        </View>
      )}

      <SpeciesGuideSheet
        guide={speciesGuide}
        spotName={selectedSpot?.name}
        onClose={() => setSpeciesGuide(null)}
        onLogFish={selectedSpot ? handleLogFromGuide : undefined}
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
