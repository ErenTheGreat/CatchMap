import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Navigation, X, Fish, Save, Clock, Trophy, ChevronRight, Info, Map, Waves, Anchor, Star, Download, CircleCheck, Trash2, Cloud, Thermometer, Wind } from 'lucide-react-native';
import { Colors, Spacing, FontSizes, BorderRadius, FontWeights } from '@/constants/theme';
import { getSpeciesRecommendations, getTimeOfDayRecommendation, getWeatherRecommendation, getMonthName, getCurrentMonth, RecommendedSpecies, NearbySpot, formatDistance, getWaterTypeIcon } from '@/utils/recommendations';
import speciesData from '@/data/species.json';
import FishingMap from '@/components/FishingMap';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useNearbyFishingSpots } from '@/hooks/useNearbyFishingSpots';
import { useOfflineMap } from '@/hooks/useOfflineMap';
import { useSaveCatch } from '@/hooks/useCatches';
import { useWeather } from '@/hooks/useWeather';
import { useSpotsInBBox } from '@/hooks/useSpotsInBBox';
import type { BBox } from '@/lib/api/fishingApi';

export default function MapScreen() {
  const { data: locationData, isLoading: locationLoading } = useUserLocation();
  const location = locationData?.location ?? null;
  const usingDefaultLocation = locationData?.isDefault ?? false;

  const { data: nearbySpots = [], isFetching: loadingSpots } =
    useNearbyFishingSpots({
      latitude: location?.latitude,
      longitude: location?.longitude,
      radiusMiles: 50,
      enabled: !!location,
    });

  const recommendations = useMemo(
    () =>
      location
        ? getSpeciesRecommendations(location.latitude, location.longitude)
        : [],
    [location]
  );

  const timeOfDay = useMemo(() => getTimeOfDayRecommendation(), []);

  const offlineMap = useOfflineMap(location?.latitude, location?.longitude);
  const { data: weather } = useWeather(location?.latitude, location?.longitude);

  // Global spatial fetching — the map camera drives which region is loaded
  const [viewBBox, setViewBBox] = useState<BBox | null>(null);
  const effectiveBBox: BBox | null =
    viewBBox ??
    (location
      ? [
          location.longitude - 0.15,
          location.latitude - 0.15,
          location.longitude + 0.15,
          location.latitude + 0.15,
        ]
      : null);
  const { data: bboxSpots = [] } = useSpotsInBBox(effectiveBBox);

  // Merge radius-based spots (rich local data wins) with global bbox spots
  const mapSpots = useMemo(() => {
    const byId: Record<string, NearbySpot> = {};
    for (const spot of [...nearbySpots, ...bboxSpots]) {
      if (!byId[spot.id]) byId[spot.id] = spot;
    }
    return Object.values(byId);
  }, [nearbySpots, bboxSpots]);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState('');
  const [weight, setWeight] = useState('');
  const [lure, setLure] = useState('');
  const [notes, setNotes] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState<RecommendedSpecies | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<NearbySpot | null>(null);

  const saveCatchMutation = useSaveCatch();
  const saving = saveCatchMutation.isPending;

  const loading = locationLoading && !locationData;

  const handleOpenModal = () => {
    setModalVisible(true);
  };

  const handleSaveCatch = () => {
    if (!selectedSpecies) {
      Alert.alert('Missing Species', 'Please select a fish species.');
      return;
    }
    if (!weight || weight.trim() === '') {
      Alert.alert('Missing Weight', 'Please enter the weight of your catch.');
      return;
    }

    const selectedSpeciesData = speciesData.find(s => s.name === selectedSpecies);
    saveCatchMutation.mutate(
      {
        species: selectedSpecies,
        speciesId: selectedSpeciesData?.id || '',
        weight: weight.trim(),
        lure: lure.trim(),
        notes: notes.trim(),
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        date: new Date().toLocaleDateString(),
      },
      {
        onSuccess: () => {
          setModalVisible(false);
          setSelectedSpecies('');
          setWeight('');
          setLure('');
          setNotes('');
          setShowDropdown(false);
          Alert.alert('Success', 'Your catch has been logged!');
        },
        onError: (error) => {
          console.error('Save catch error:', error);
          Alert.alert('Error', 'Failed to save catch. Please try again.');
        },
      }
    );
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedSpecies('');
    setWeight('');
    setLure('');
    setNotes('');
    setShowDropdown(false);
  };

  const useRecommendation = (rec: RecommendedSpecies) => {
    setSelectedSpecies(rec.name);
    setLure(rec.recommendedLure);
    setSelectedRecommendation(null);
    setModalVisible(true);
  };

  const useSpotSpecies = (spot: NearbySpot) => {
    if (spot.matchedSpecies.length > 0) {
      setSelectedSpecies(spot.matchedSpecies[0]);
      const speciesInfo = speciesData.find(s => s.name === spot.matchedSpecies[0]);
      if (speciesInfo && speciesInfo.lures.length > 0) {
        setLure(speciesInfo.lures[0]);
      }
      setSelectedSpot(null);
      setModalVisible(true);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.loadingText}>Loading Map...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <MapPin color={Colors.accent} size={24} />
          <Text style={styles.headerText}>Fishing Map</Text>
        </View>

        {usingDefaultLocation && (
          <View style={styles.locationBanner}>
            <Info color={Colors.textSecondary} size={16} />
            <Text style={styles.locationBannerText}>
              Enable location access to see fishing spots near you.
            </Text>
          </View>
        )}

        {location && (
          <View style={styles.mapWrapper}>
            <FishingMap
              latitude={location.latitude}
              longitude={location.longitude}
              nearbySpots={mapSpots}
              onSpotPress={setSelectedSpot}
              onRegionChange={setViewBBox}
            />
          </View>
        )}

        {offlineMap.state !== 'unavailable' && (
          <View style={styles.offlineRow}>
            {offlineMap.state === 'idle' && (
              <TouchableOpacity style={styles.offlineButton} onPress={offlineMap.download}>
                <Download color={Colors.accent} size={16} />
                <Text style={styles.offlineButtonText}>Save this area for offline use</Text>
              </TouchableOpacity>
            )}
            {offlineMap.state === 'downloading' && (
              <View style={styles.offlineButton}>
                <ActivityIndicator color={Colors.accent} size="small" />
                <Text style={styles.offlineButtonText}>
                  Downloading offline map… {offlineMap.percentage}%
                </Text>
              </View>
            )}
            {offlineMap.state === 'complete' && (
              <View style={styles.offlineButton}>
                <CircleCheck color={Colors.success} size={16} />
                <Text style={styles.offlineButtonText}>Offline map saved</Text>
                <TouchableOpacity onPress={offlineMap.remove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Trash2 color={Colors.textMuted} size={16} />
                </TouchableOpacity>
              </View>
            )}
            {offlineMap.state === 'error' && (
              <TouchableOpacity style={styles.offlineButton} onPress={offlineMap.download}>
                <Info color={Colors.error} size={16} />
                <Text style={styles.offlineButtonText}>
                  Download failed — tap to retry
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Clock color={Colors.accent} size={18} />
          <Text style={styles.sectionTitle}>Best Time Now</Text>
        </View>
        <View style={styles.timeCard}>
          <Text style={styles.timePeriod}>{timeOfDay.period}</Text>
          <Text style={styles.timeTip}>{timeOfDay.tip}</Text>
        </View>

        {weather && (
          <>
            <View style={styles.sectionHeader}>
              <Cloud color={Colors.accent} size={18} />
              <Text style={styles.sectionTitle}>Conditions</Text>
            </View>
            <View style={styles.timeCard}>
              <View style={styles.weatherRow}>
                <View style={styles.weatherStat}>
                  <Thermometer color={Colors.textSecondary} size={16} />
                  <Text style={styles.weatherValue}>{Math.round(weather.temperatureF)}°F</Text>
                </View>
                <View style={styles.weatherStat}>
                  <Wind color={Colors.textSecondary} size={16} />
                  <Text style={styles.weatherValue}>{Math.round(weather.windSpeedMph)} mph</Text>
                </View>
                <View style={styles.weatherStat}>
                  <Cloud color={Colors.textSecondary} size={16} />
                  <Text style={styles.weatherValue}>{weather.cloudCoverPercent}% cloud</Text>
                </View>
              </View>
              <Text style={styles.timeTip}>
                {getWeatherRecommendation(weather.temperatureF).tip}
              </Text>
            </View>
          </>
        )}

        <View style={styles.sectionHeader}>
          <Fish color={Colors.accent} size={18} />
          <Text style={styles.sectionTitle}>Fish to Catch in {getMonthName(getCurrentMonth())}</Text>
        </View>

        {recommendations.length > 0 && (
          <View style={styles.recommendationList}>
            {recommendations.map((rec) => (
              <TouchableOpacity
                key={rec.id}
                style={[styles.recommendationCard, rec.isPeak && styles.peakCard]}
                onPress={() => setSelectedRecommendation(selectedRecommendation?.id === rec.id ? null : rec)}
                activeOpacity={0.7}
              >
                <View style={styles.recHeader}>
                  <View style={styles.recIcon}>
                    <Fish color={Colors.accent} size={18} />
                  </View>
                  <View style={styles.recInfo}>
                    <Text style={styles.recName}>{rec.name}</Text>
                    <Text style={styles.recHabitat}>{rec.habitat}</Text>
                  </View>
                  {rec.isPeak && (
                    <View style={styles.peakBadge}>
                      <Trophy color={Colors.background} size={12} />
                      <Text style={styles.peakBadgeText}>PEAK</Text>
                    </View>
                  )}
                  <ChevronRight
                    color={selectedRecommendation?.id === rec.id ? Colors.accent : Colors.textMuted}
                    size={20}
                  />
                </View>

                {selectedRecommendation?.id === rec.id && (
                  <View style={styles.recExpanded}>
                    <Text style={styles.recDescription}>{rec.tips}</Text>
                    <View style={styles.recDetails}>
                      <View style={styles.recDetailItem}>
                        <Text style={styles.recDetailLabel}>Avg Weight</Text>
                        <Text style={styles.recDetailValue}>{rec.averageWeight}</Text>
                      </View>
                      <View style={styles.recDetailItem}>
                        <Text style={styles.recDetailLabel}>Best Lure</Text>
                        <Text style={styles.recDetailValue}>{rec.recommendedLure}</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.useRecButton} onPress={() => useRecommendation(rec)}>
                      <Fish color={Colors.background} size={16} />
                      <Text style={styles.useRecText}>Log This Fish</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Map color={Colors.accent} size={18} />
          <Text style={styles.sectionTitle}>Nearby Fishing Spots</Text>
        </View>

        {(loadingSpots && nearbySpots.length === 0) ? (
          <View style={styles.loadingSpots}>
            <ActivityIndicator color={Colors.accent} size="small" />
            <Text style={styles.loadingSpotsText}>Finding nearby spots...</Text>
          </View>
        ) : nearbySpots.length === 0 ? (
          <View style={styles.noSpots}>
            <Waves color={Colors.textMuted} size={32} />
            <Text style={styles.noSpotsText}>No fishing spots nearby</Text>
          </View>
        ) : (
          <View style={styles.spotsList}>
            {nearbySpots.slice(0, 5).map((spot) => (
              <TouchableOpacity
                key={spot.id}
                style={[styles.spotCard, spot.isPeakSeason && styles.peakSeasonCard]}
                onPress={() => setSelectedSpot(selectedSpot?.id === spot.id ? null : spot)}
                activeOpacity={0.7}
              >
                <View style={styles.spotHeader}>
                  <View style={styles.spotIcon}>
                    <Anchor color={Colors.accent} size={20} />
                  </View>
                  <View style={styles.spotInfo}>
                    <Text style={styles.spotName}>{spot.name}</Text>
                    <View style={styles.spotMeta}>
                      <Waves color={Colors.textMuted} size={12} />
                      <Text style={styles.spotType}>{getWaterTypeIcon(spot.water_type)}</Text>
                      <Text style={styles.spotDistance}>{formatDistance(spot.distance)}</Text>
                      <Star color={Colors.warning} size={12} fill={Colors.warning} />
                      <Text style={styles.spotRating}>{spot.rating.toFixed(1)}</Text>
                    </View>
                  </View>
                  {spot.isPeakSeason && (
                    <View style={styles.peakSeasonBadge}>
                      <Trophy color={Colors.background} size={10} />
                      <Text style={styles.peakSeasonText}>PEAK</Text>
                    </View>
                  )}
                </View>

                {selectedSpot?.id === spot.id && (
                  <View style={styles.spotExpanded}>
                    <Text style={styles.spotDescription}>{spot.description}</Text>

                    {(spot.avgDepthFeet != null || spot.bestSeason) && (
                      <View style={styles.spotFacilities}>
                        <Text style={styles.facilitiesTitle}>Conditions: </Text>
                        <Text style={styles.facilitiesList}>
                          {[
                            spot.avgDepthFeet != null ? `Avg depth ${spot.avgDepthFeet} ft` : null,
                            spot.bestSeason ? `Best in ${spot.bestSeason}` : null,
                          ].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                    )}

                    {spot.underwaterStructure && spot.underwaterStructure.length > 0 && (
                      <View style={styles.spotFacilities}>
                        <Text style={styles.facilitiesTitle}>Structure: </Text>
                        <Text style={styles.facilitiesList}>
                          {spot.underwaterStructure.join(', ')}
                        </Text>
                      </View>
                    )}

                    <View style={styles.spotFishSection}>
                      <Text style={styles.spotFishTitle}>Available Fish:</Text>
                      <View style={styles.spotFishList}>
                        {spot.matchedSpecies.length > 0 ? (
                          spot.matchedSpecies.map((fish, idx) => (
                            <View key={idx} style={styles.fishChip}>
                              <Fish color={Colors.accent} size={12} />
                              <Text style={styles.fishChipText}>{fish}</Text>
                            </View>
                          ))
                        ) : (
                          <Text style={styles.noFishText}>Various species available</Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.spotFacilities}>
                      <Text style={styles.facilitiesTitle}>Facilities: </Text>
                      <Text style={styles.facilitiesList}>
                        {spot.facilities.map(f => f.replace('_', ' ')).join(', ') || 'None listed'}
                      </Text>
                    </View>

                    <View style={styles.spotActionRow}>
                      <TouchableOpacity
                        style={styles.directionsButton}
                        onPress={() => {
                          const url = Platform.OS === 'web'
                            ? `https://www.google.com/maps/search/?api=1&query=${spot.latitude},${spot.longitude}`
                            : `geo:${spot.latitude},${spot.longitude}`;
                          if (Platform.OS === 'web') {
                            window.open(url, '_blank');
                          }
                        }}
                      >
                        <Navigation color={Colors.background} size={14} />
                        <Text style={styles.directionsText}>Directions</Text>
                      </TouchableOpacity>

                      {spot.matchedSpecies.length > 0 && (
                        <TouchableOpacity
                          style={styles.logSpotButton}
                          onPress={() => useSpotSpecies(spot)}
                        >
                          <Fish color={Colors.accent} size={14} />
                          <Text style={styles.logSpotText}>Log Fish</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={handleOpenModal} activeOpacity={0.8}>
        <Fish color={Colors.background} size={24} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeModal} />
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log Your Catch</Text>
              <TouchableOpacity onPress={closeModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X color={Colors.text} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.formGroup}>
                <Text style={styles.label}>Fish Species *</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowDropdown(!showDropdown)}
                  activeOpacity={0.7}
                >
                  <Text style={selectedSpecies ? styles.dropdownText : styles.dropdownPlaceholder}>
                    {selectedSpecies || 'Select species...'}
                  </Text>
                  <Text style={styles.dropdownArrow}>{showDropdown ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {showDropdown && (
                  <ScrollView style={styles.dropdownList} nestedScrollEnabled showsVerticalScrollIndicator>
                    {speciesData.map((species) => (
                      <TouchableOpacity
                        key={species.id}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setSelectedSpecies(species.name);
                          setShowDropdown(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.dropdownItemText}>{species.name}</Text>
                        <Text style={styles.dropdownItemHabitat}>{species.habitat}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Weight *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 4.5 lbs"
                  placeholderTextColor={Colors.textMuted}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Lure Used</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Crankbait, Spinner..."
                  placeholderTextColor={Colors.textMuted}
                  value={lure}
                  onChangeText={setLure}
                />
                {selectedSpecies && (
                  <View style={styles.lureSuggestions}>
                    {speciesData.find(s => s.name === selectedSpecies)?.lures.slice(0, 3).map((l, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.lureChip}
                        onPress={() => setLure(l)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.lureChipText}>{l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Details about your catch..."
                  placeholderTextColor={Colors.textMuted}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSaveCatch}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.background} size="small" />
                ) : (
                  <>
                    <Save color={Colors.background} size={20} />
                    <Text style={styles.saveButtonText}>Save Catch</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerText: {
    color: Colors.text,
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.cardLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locationBannerText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  mapWrapper: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    height: 280,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  offlineRow: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  offlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: Colors.cardLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  offlineButtonText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
  },
  timeCard: {
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timePeriod: {
    color: Colors.accent,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    marginBottom: Spacing.xs,
  },
  timeTip: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    lineHeight: 22,
  },
  weatherRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  weatherStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  weatherValue: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  recommendationList: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  recommendationCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  peakCard: {
    borderColor: Colors.accent,
    backgroundColor: Colors.cardLight,
  },
  recHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  recIcon: {
    backgroundColor: Colors.accentDark,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  recInfo: {
    flex: 1,
  },
  recName: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  recHabitat: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
  peakBadge: {
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  peakBadgeText: {
    color: Colors.background,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
  },
  recExpanded: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  recDescription: {
    color: Colors.textSecondary,
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
    color: Colors.textMuted,
    fontSize: FontSizes.xs,
    textTransform: 'uppercase',
  },
  recDetailValue: {
    color: Colors.text,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    marginTop: Spacing.xs,
  },
  useRecButton: {
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  useRecText: {
    color: Colors.background,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  loadingSpots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  loadingSpotsText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
  },
  noSpots: {
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  noSpotsText: {
    color: Colors.textMuted,
    fontSize: FontSizes.md,
    marginTop: Spacing.sm,
  },
  spotsList: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  spotCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  peakSeasonCard: {
    borderColor: Colors.success,
    backgroundColor: Colors.cardLight,
  },
  spotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  spotIcon: {
    backgroundColor: Colors.accentDark,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  spotInfo: {
    flex: 1,
  },
  spotName: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  spotMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  spotType: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  spotDistance: {
    color: Colors.accent,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  spotRating: {
    color: Colors.warning,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  peakSeasonBadge: {
    backgroundColor: Colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 2,
  },
  peakSeasonText: {
    color: Colors.background,
    fontSize: 10,
    fontWeight: FontWeights.bold,
  },
  spotExpanded: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  spotDescription: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  spotFishSection: {
    marginBottom: Spacing.sm,
  },
  spotFishTitle: {
    color: Colors.text,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    marginBottom: Spacing.xs,
  },
  spotFishList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  fishChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentDark,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  fishChipText: {
    color: Colors.accent,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
  },
  noFishText: {
    color: Colors.textMuted,
    fontSize: FontSizes.sm,
    fontStyle: 'italic',
  },
  spotFacilities: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  facilitiesTitle: {
    color: Colors.textMuted,
    fontSize: FontSizes.xs,
    textTransform: 'uppercase',
  },
  facilitiesList: {
    color: Colors.text,
    fontSize: FontSizes.sm,
    flex: 1,
  },
  spotActionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  directionsButton: {
    backgroundColor: Colors.accent,
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
    color: Colors.background,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  logSpotButton: {
    backgroundColor: Colors.cardLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent,
    flex: 1,
  },
  logSpotText: {
    color: Colors.accent,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  bottomPadding: {
    height: 100,
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.lg,
    backgroundColor: Colors.accent,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
  },
  formGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSizes.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 80,
  },
  dropdownButton: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    color: Colors.text,
    fontSize: FontSizes.md,
    flex: 1,
  },
  dropdownPlaceholder: {
    color: Colors.textMuted,
    fontSize: FontSizes.md,
    flex: 1,
  },
  dropdownArrow: {
    color: Colors.accent,
    fontSize: FontSizes.sm,
    marginLeft: Spacing.sm,
  },
  dropdownList: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
    maxHeight: 180,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dropdownItem: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownItemText: {
    color: Colors.text,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
  },
  dropdownItemHabitat: {
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
    marginTop: 2,
  },
  lureSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  lureChip: {
    backgroundColor: Colors.accentDark,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  lureChipText: {
    color: Colors.accent,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.background,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
  },
});
