import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Image,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fish, MapPin, Calendar, Weight, Ruler, Trash2, Trophy, TrendingUp, CloudOff, RefreshCw, X, Pencil, Award, Thermometer, Cloud, Waves, Search } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useCatches, useDeleteCatch, useSyncCatches, useUpdateCatch } from '@/hooks/useCatches';
import { useCatchInsights } from '@/hooks/useCatchInsights';
import { getPersonalBestCatchIds } from '@/utils/catchInsights';
import CatchInsightsPanel from '@/components/history/CatchInsightsPanel';
import LogCatchForm, { type LogCatchFormValues } from '@/components/catch/LogCatchForm';
import speciesData from '@/data/species.json';
import type { CatchRecord } from '@/lib/api/fishingApi';
import type { CatchLocation } from '@/utils/catchLocation';
import { EmptyState, ErrorState, Skeleton, ThemeToggleButton, SettingsButton, useToast, ResponsiveScreen, AppScreenHeader, SearchField, FadeInView, ThemedText, ScalePressable } from '@/components/ui';
import { hapticSuccess, hapticError } from '@/utils/haptics';
import { getCatchSyncLabel, isLocalOnlyCatch } from '@/utils/catchStatus';
import { isCloudSyncEnabled } from '@/constants/features';
import { getSpeciesImageUrl } from '@/utils/speciesLookup';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useTheme } from '@/providers/ThemeProvider';
import { useUnits } from '@/providers/UnitsProvider';
import { confirmDiscardUnsavedChanges } from '@/utils/unsavedChanges';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      marginBottom: Spacing.sm,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      flex: 1,
    },
    headerTitle: {
      color: colors.text,
      fontSize: FontSizes.xxl,
      fontWeight: FontWeights.bold,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    syncBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      marginHorizontal: Spacing.md,
      marginBottom: Spacing.md,
      padding: Spacing.sm,
      backgroundColor: colors.warningSurface,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.toastWarning,
    },
    syncBannerText: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    syncBannerMessage: {
      flex: 1,
      color: colors.text,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    syncButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.accent,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.sm,
    },
    syncButtonText: {
      color: colors.accentForeground,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.semibold,
    },
    statsContainer: {
      flexDirection: 'row',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.lg,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    statValue: {
      color: colors.text,
      fontSize: FontSizes.xxl,
      fontWeight: FontWeights.bold,
      marginTop: Spacing.xs,
    },
    statLabel: {
      color: colors.textSecondary,
      fontSize: FontSizes.xs,
      marginTop: Spacing.xs,
    },
    listView: {
      flex: 1,
      paddingHorizontal: Spacing.md,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.semibold,
      marginBottom: Spacing.sm,
    },
    controls: {
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: FontSizes.md,
      paddingVertical: Spacing.sm,
      marginLeft: Spacing.sm,
    },
    chipRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
      paddingRight: Spacing.md,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    chipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    chipTextActive: {
      color: colors.accentForeground,
    },
    controlLabel: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontWeight: FontWeights.semibold,
    },
    catchCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    catchCardWide: {
      flexGrow: 1,
      flexBasis: '48%',
      minWidth: 280,
      maxWidth: '100%',
    },
    catchList: {
      gap: Spacing.sm,
    },
    catchListWide: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    catchCardPending: {
      borderColor: colors.toastWarning,
      opacity: 0.92,
    },
    catchHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    catchIcon: {
      backgroundColor: colors.accentDark,
      padding: Spacing.sm,
      borderRadius: BorderRadius.md,
      overflow: 'hidden',
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catchImage: {
      width: 44,
      height: 44,
      borderRadius: BorderRadius.md,
    },
    catchPhoto: {
      width: '100%',
      height: 200,
      borderRadius: BorderRadius.md,
      marginTop: Spacing.sm,
      backgroundColor: colors.cardLight,
    },
    photoViewerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.92)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoViewerImage: {
      width: '100%',
      height: '80%',
    },
    photoViewerClose: {
      position: 'absolute',
      top: Spacing.xl,
      right: Spacing.lg,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    catchInfo: {
      flex: 1,
    },
    speciesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    syncBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.warningSurface,
      paddingHorizontal: Spacing.xs,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
    },
    pbBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.successSurface,
      paddingHorizontal: Spacing.xs,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
    },
    pbBadgeText: {
      color: colors.success,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.bold,
      letterSpacing: 0.4,
    },
    conditionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
      marginTop: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    conditionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    conditionText: {
      color: colors.textSecondary,
      fontSize: FontSizes.xs,
    },
    syncBadgeText: {
      color: colors.warning,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.medium,
    },
    catchSpecies: {
      color: colors.text,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.semibold,
    },
    catchMeta: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.xs,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    metaText: {
      color: colors.textMuted,
      fontSize: FontSizes.sm,
    },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    editButton: {
      backgroundColor: colors.cardLight,
      padding: Spacing.sm,
      borderRadius: BorderRadius.md,
    },
    deleteButton: {
      backgroundColor: colors.errorSurface,
      padding: Spacing.sm,
      borderRadius: BorderRadius.md,
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
      maxHeight: '90%',
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
    catchDetail: {
      flexDirection: 'row',
      marginTop: Spacing.sm,
    },
    detailLabel: {
      color: colors.textMuted,
      fontSize: FontSizes.sm,
    },
    detailValue: {
      color: colors.text,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    catchNotes: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      marginTop: Spacing.sm,
      fontStyle: 'italic',
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.sm,
      flexWrap: 'wrap',
    },
    locationText: {
      color: colors.accent,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    locationTextBlock: {
      flex: 1,
      gap: 2,
    },
    locationSubtext: {
      color: colors.textSecondary,
      fontSize: FontSizes.xs,
    },
    locationAction: {
      color: colors.textSecondary,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.semibold,
      marginLeft: 'auto',
    },
    bottomPadding: {
      height: Spacing.xxl,
    },
    skeletonList: {
      paddingHorizontal: Spacing.md,
      gap: Spacing.sm,
    },
    skeletonCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    skeletonContent: {
      flex: 1,
    },
  });
}

function HistorySkeleton() {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.skeletonList}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <Skeleton width={40} height={40} borderRadius={BorderRadius.md} />
          <View style={styles.skeletonContent}>
            <Skeleton width="60%" height={16} />
            <Skeleton width="40%" height={12} style={{ marginTop: Spacing.xs }} />
          </View>
        </View>
      ))}
    </View>
  );
}

function HistoryHeader() {
  return (
    <AppScreenHeader
      variant="compact"
      title="Fishing History"
      subtitle="Your catches"
      actions={
        <>
          <SettingsButton />
          <ThemeToggleButton />
        </>
      }
    />
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { isWide, modalMaxWidth } = useResponsiveLayout();
  const { formatTemperature } = useUnits();
  const {
    data: catches = [],
    isLoading: loading,
    isError,
    isRefetching: refreshing,
    refetch,
  } = useCatches();
  const { insights, fingerprint } = useCatchInsights();
  const deleteCatchMutation = useDeleteCatch();
  const updateCatchMutation = useUpdateCatch();
  const syncMutation = useSyncCatches();
  const { showToast } = useToast();
  const [photoViewerUri, setPhotoViewerUri] = useState<string | null>(null);
  const [editingCatch, setEditingCatch] = useState<CatchRecord | null>(null);
  const [editFormKey, setEditFormKey] = useState(0);
  const [editDirty, setEditDirty] = useState(false);

  const editLocation: CatchLocation | undefined = useMemo(() => {
    if (!editingCatch) return undefined;
    return {
      latitude: editingCatch.latitude,
      longitude: editingCatch.longitude,
      locationName: editingCatch.locationName,
    };
  }, [editingCatch]);

  const openEdit = (record: CatchRecord) => {
    setEditingCatch(record);
    setEditFormKey((k) => k + 1);
    setEditDirty(false);
  };

  const editInitialValues = useMemo<Partial<LogCatchFormValues> | null>(() => {
    if (!editingCatch) return null;
    return {
      species: editingCatch.species,
      weight: editingCatch.weight,
      length: editingCatch.length ?? '',
      lure: editingCatch.lure,
      notes: editingCatch.notes,
      photoUri: editingCatch.photoUri ?? null,
      caughtAt: editingCatch.createdAt,
      sharedAnonymously: editingCatch.sharedAnonymously ?? false,
    };
  }, [editingCatch]);

  const closeEdit = () => {
    confirmDiscardUnsavedChanges({
      isDirty: editDirty,
      onDiscard: () => {
        setEditingCatch(null);
        setEditDirty(false);
      },
    });
  };

  const handleUpdateCatch = (values: LogCatchFormValues) => {
    if (!editingCatch) return;
    const matchedSpecies = speciesData.find((s) => s.name === values.species);
    updateCatchMutation.mutate(
      {
        id: editingCatch.id,
        changes: {
          species: values.species,
          speciesId: matchedSpecies?.id ?? editingCatch.speciesId,
          weight: values.weight,
          length: values.length,
          lure: values.lure,
          notes: values.notes,
          photoUri: values.photoUri,
          caughtAt: values.caughtAt,
          sharedAnonymously: values.sharedAnonymously,
        },
      },
      {
        onSuccess: () => {
          hapticSuccess();
          showToast({ message: 'Catch updated', variant: 'success' });
          setEditingCatch(null);
          setEditDirty(false);
        },
        onError: () => {
          hapticError();
          showToast({ message: 'Failed to update catch', variant: 'error' });
        },
      }
    );
  };

  const pendingSyncCount = useMemo(
    () => (isCloudSyncEnabled() ? catches.filter((c) => isLocalOnlyCatch(c.id)).length : 0),
    [catches]
  );

  const personalBestIds = useMemo(() => getPersonalBestCatchIds(catches), [catches]);

  const [searchQuery, setSearchQuery] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'newest' | 'heaviest' | 'species'>('newest');

  const speciesOptions = useMemo(
    () => Array.from(new Set(catches.map((c) => c.species))).sort(),
    [catches]
  );

  const visibleCatches = useMemo(() => {
    let list = catches;
    if (speciesFilter) {
      list = list.filter((c) => c.species === speciesFilter);
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (c) =>
          c.species.toLowerCase().includes(query) ||
          (c.notes ?? '').toLowerCase().includes(query) ||
          (c.locationName ?? '').toLowerCase().includes(query) ||
          (c.lure ?? '').toLowerCase().includes(query)
      );
    }
    const sorted = [...list];
    if (sortMode === 'heaviest') {
      sorted.sort((a, b) => (parseFloat(b.weight) || 0) - (parseFloat(a.weight) || 0));
    } else if (sortMode === 'species') {
      sorted.sort(
        (a, b) => a.species.localeCompare(b.species) || b.createdAt - a.createdAt
      );
    } else {
      sorted.sort((a, b) => b.createdAt - a.createdAt);
    }
    return sorted;
  }, [catches, speciesFilter, searchQuery, sortMode]);

  const SORT_OPTIONS: { id: typeof sortMode; label: string }[] = [
    { id: 'newest', label: 'Newest' },
    { id: 'heaviest', label: 'Heaviest' },
    { id: 'species', label: 'Species A–Z' },
  ];

  const onRefresh = () => {
    if (isCloudSyncEnabled()) {
      syncMutation.mutate(undefined, {
        onSettled: () => refetch(),
      });
      return;
    }
    refetch();
  };

  const handleSyncNow = () => {
    syncMutation.mutate(undefined, {
      onSuccess: (result) => {
        refetch();
        if (result.synced > 0) {
          hapticSuccess();
          showToast({
            message:
              result.synced === 1
                ? '1 catch synced to the cloud'
                : `${result.synced} catches synced to the cloud`,
            variant: 'success',
          });
        } else if (result.failed > 0) {
          hapticError();
          showToast({
            message: 'Could not sync catches — check your connection',
            variant: 'error',
          });
        } else {
          showToast({ message: 'All catches are already synced', variant: 'success' });
        }
      },
      onError: () => {
        hapticError();
        showToast({ message: 'Could not sync catches', variant: 'error' });
      },
    });
  };

  const handleDelete = (id: string, species: string) => {
    Alert.alert(
      'Delete Catch',
      `Are you sure you want to delete this ${species} catch?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteCatchMutation.mutate(id, {
              onSuccess: (result) => {
                hapticSuccess();
                if (result.cloudDeleteFailed) {
                  showToast({
                    message: 'Catch removed locally; cloud copy may still exist',
                    variant: 'warning',
                  });
                } else {
                  showToast({ message: 'Catch deleted', variant: 'success' });
                }
              },
              onError: () => {
                hapticError();
                showToast({ message: 'Failed to delete catch', variant: 'error' });
              },
            });
          },
        },
      ]
    );
  };

  const totalCatches = catches.length;
  const uniqueSpecies = new Set(catches.map((c) => c.species)).size;

  const biggestCatch = catches.reduce(
    (max, c) => {
      const weight = parseFloat(c.weight) || 0;
      const maxWeight = parseFloat(max?.weight) || 0;
      return weight > maxWeight ? c : max;
    },
    catches[0] || null
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ResponsiveScreen>
          <HistoryHeader />
          <HistorySkeleton />
        </ResponsiveScreen>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container}>
        <ResponsiveScreen>
          <HistoryHeader />
          <ErrorState
            title="Could not load catches"
            message="Your catch history is unavailable right now."
            onRetry={() => refetch()}
          />
        </ResponsiveScreen>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ResponsiveScreen>
      <HistoryHeader />

      {pendingSyncCount > 0 && (
        <View style={styles.syncBanner}>
          <View style={styles.syncBannerText}>
            <CloudOff color={colors.warning} size={16} />
            <ThemedText style={styles.syncBannerMessage}>
              {pendingSyncCount === 1
                ? '1 catch saved on this device'
                : `${pendingSyncCount} catches saved on this device`}
            </ThemedText>
          </View>
          <TouchableOpacity
            style={styles.syncButton}
            onPress={handleSyncNow}
            disabled={syncMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="Sync catches to the cloud"
          >
            <RefreshCw color={colors.accentForeground} size={14} />
            <ThemedText style={styles.syncButtonText}>
              {syncMutation.isPending ? 'Syncing…' : 'Sync now'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {totalCatches > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Fish color={colors.accent} size={24} />
            <ThemedText style={styles.statValue}>{totalCatches}</ThemedText>
            <ThemedText style={styles.statLabel}>Total Catches</ThemedText>
          </View>
          <View style={styles.statCard}>
            <Trophy color={colors.warning} size={24} />
            <ThemedText style={styles.statValue}>{uniqueSpecies}</ThemedText>
            <ThemedText style={styles.statLabel}>Species</ThemedText>
          </View>
          <View style={styles.statCard}>
            <TrendingUp color={colors.success} size={24} />
            <ThemedText style={styles.statValue}>
              {biggestCatch ? biggestCatch.weight : 'N/A'}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Biggest</ThemedText>
          </View>
        </View>
      )}

      {catches.length === 0 ? (
        <ScrollView
          style={styles.listView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        >
          <EmptyState
            icon={<Fish color={colors.textMuted} size={64} />}
            title="No catches recorded yet"
            subtitle="Start logging your catches to see them here"
            actionLabel="Log a Catch"
            onAction={() => router.push('/log')}
          />
          <View style={styles.bottomPadding} />
        </ScrollView>
      ) : (
        <FlatList
          style={styles.listView}
          data={visibleCatches}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
          ListHeaderComponent={
            <>
              <CatchInsightsPanel
                insights={insights}
                fingerprint={fingerprint}
                onViewSpotOnMap={(lat, lon) =>
                  router.push({
                    pathname: '/(tabs)',
                    params: { lat: String(lat), lng: String(lon) },
                  })
                }
              />
              <View style={styles.controls}>
                <SearchField
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search species, lure, notes, place..."
                  accessibilityLabel="Search catches"
                />

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {SORT_OPTIONS.map((option) => {
                    const active = sortMode === option.id;
                    return (
                      <TouchableOpacity
                        key={option.id}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setSortMode(option.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Sort by ${option.label}`}
                      >
                        <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>
                          {option.label}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {speciesOptions.length > 1 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                  >
                    <TouchableOpacity
                      style={[styles.chip, speciesFilter === null && styles.chipActive]}
                      onPress={() => setSpeciesFilter(null)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: speciesFilter === null }}
                      accessibilityLabel="Show all species"
                    >
                      <ThemedText
                        style={[styles.chipText, speciesFilter === null && styles.chipTextActive]}
                      >
                        All species
                      </ThemedText>
                    </TouchableOpacity>
                    {speciesOptions.map((sp) => {
                      const active = speciesFilter === sp;
                      return (
                        <TouchableOpacity
                          key={sp}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => setSpeciesFilter(active ? null : sp)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={`Filter by ${sp}`}
                        >
                          <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>
                            {sp}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              <ThemedText style={styles.sectionTitle}>
                {visibleCatches.length === catches.length
                  ? 'Recent Catches'
                  : `Showing ${visibleCatches.length} of ${catches.length}`}
              </ThemedText>

              {visibleCatches.length === 0 ? (
                <EmptyState
                  icon={<Search color={colors.textMuted} size={48} />}
                  title="No matching catches"
                  subtitle="Try a different search or clear the filters."
                  actionLabel="Clear filters"
                  onAction={() => {
                    setSearchQuery('');
                    setSpeciesFilter(null);
                  }}
                />
              ) : null}
            </>
          }
          contentContainerStyle={[styles.catchList, isWide && styles.catchListWide]}
          renderItem={({ item: catchRecord, index }) => {
            const syncLabel = getCatchSyncLabel(catchRecord.id);
            const speciesImage = getSpeciesImageUrl(catchRecord.species, catchRecord.speciesId);
            const isPersonalBest = personalBestIds.has(catchRecord.id);
            const conditions = catchRecord.conditions;

            return (
              <FadeInView
                delay={Math.min(index * 40, 280)}
                style={[
                  styles.catchCard,
                  isWide && styles.catchCardWide,
                  syncLabel ? styles.catchCardPending : null,
                ]}
              >
                <View style={styles.catchHeader}>
                  <View style={styles.catchIcon}>
                    {speciesImage ? (
                      <Image source={{ uri: speciesImage }} style={styles.catchImage} />
                    ) : (
                      <Fish color={colors.accent} size={20} />
                    )}
                  </View>
                  <View style={styles.catchInfo}>
                    <View style={styles.speciesRow}>
                      <ThemedText style={styles.catchSpecies}>{catchRecord.species}</ThemedText>
                      {isPersonalBest ? (
                        <View style={styles.pbBadge}>
                          <Award color={colors.success} size={10} />
                          <ThemedText style={styles.pbBadgeText}>PB</ThemedText>
                        </View>
                      ) : null}
                      {syncLabel ? (
                        <View style={styles.syncBadge}>
                          <CloudOff color={colors.warning} size={10} />
                          <ThemedText style={styles.syncBadgeText}>{syncLabel}</ThemedText>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.catchMeta}>
                      <View style={styles.metaItem}>
                        <Weight color={colors.textMuted} size={12} />
                        <ThemedText style={styles.metaText}>{catchRecord.weight}</ThemedText>
                      </View>
                      {catchRecord.length ? (
                        <View style={styles.metaItem}>
                          <Ruler color={colors.textMuted} size={12} />
                          <ThemedText style={styles.metaText}>{catchRecord.length}</ThemedText>
                        </View>
                      ) : null}
                      <View style={styles.metaItem}>
                        <Calendar color={colors.textMuted} size={12} />
                        <ThemedText style={styles.metaText}>{catchRecord.date}</ThemedText>
                      </View>
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => openEdit(catchRecord)}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${catchRecord.species} catch`}
                    >
                      <Pencil color={colors.textSecondary} size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDelete(catchRecord.id, catchRecord.species)}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${catchRecord.species} catch`}
                    >
                      <Trash2 color={colors.error} size={18} />
                    </TouchableOpacity>
                  </View>
                </View>

                {catchRecord.photoUri && (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setPhotoViewerUri(catchRecord.photoUri!)}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={`View photo of ${catchRecord.species} catch`}
                  >
                    <Image
                      source={{ uri: catchRecord.photoUri }}
                      style={styles.catchPhoto}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}

                {catchRecord.lure && (
                  <View style={styles.catchDetail}>
                    <ThemedText style={styles.detailLabel}>Lure: </ThemedText>
                    <ThemedText style={styles.detailValue}>{catchRecord.lure}</ThemedText>
                  </View>
                )}

                {catchRecord.notes && (
                  <ThemedText style={styles.catchNotes}>{catchRecord.notes}</ThemedText>
                )}

                {conditions &&
                  (conditions.temperatureF != null ||
                    conditions.skyLabel ||
                    conditions.tideNote) && (
                    <View style={styles.conditionsRow}>
                      {conditions.temperatureF != null && (
                        <View style={styles.conditionItem}>
                          <Thermometer color={colors.textMuted} size={12} />
                          <ThemedText style={styles.conditionText}>
                            {formatTemperature(conditions.temperatureF)}
                          </ThemedText>
                        </View>
                      )}
                      {conditions.skyLabel && (
                        <View style={styles.conditionItem}>
                          <Cloud color={colors.textMuted} size={12} />
                          <ThemedText style={styles.conditionText}>{conditions.skyLabel}</ThemedText>
                        </View>
                      )}
                      {conditions.tideNote && (
                        <View style={styles.conditionItem}>
                          <Waves color={colors.textMuted} size={12} />
                          <ThemedText style={styles.conditionText} numberOfLines={1}>
                            {conditions.tideNote}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  )}

                {catchRecord.latitude != null && catchRecord.longitude != null && (
                  <ScalePressable
                    style={styles.locationRow}
                    onPress={() =>
                      router.push({
                        pathname: '/(tabs)',
                        params: {
                          lat: String(catchRecord.latitude),
                          lng: String(catchRecord.longitude),
                        },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`View catch location on map${catchRecord.locationName ? ` at ${catchRecord.locationName}` : ''}`}
                    accessibilityHint="Opens the map and flies to this catch"
                  >
                    <MapPin color={colors.accent} size={12} />
                    <View style={styles.locationTextBlock}>
                      <ThemedText style={styles.locationText}>
                        {catchRecord.locationName ??
                          `${catchRecord.latitude.toFixed(4)}°, ${catchRecord.longitude.toFixed(4)}°`}
                      </ThemedText>
                      {catchRecord.locationName ? (
                        <ThemedText style={styles.locationSubtext}>
                          {catchRecord.latitude.toFixed(4)}°, {catchRecord.longitude.toFixed(4)}°
                        </ThemedText>
                      ) : null}
                    </View>
                    <ThemedText style={styles.locationAction}>View on Map</ThemedText>
                  </ScalePressable>
                )}
              </FadeInView>
            );
          }}
          ListFooterComponent={<View style={styles.bottomPadding} />}
        />
      )}
      </ResponsiveScreen>

      <Modal
        visible={photoViewerUri != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoViewerUri(null)}
      >
        <Pressable
          style={styles.photoViewerOverlay}
          onPress={() => setPhotoViewerUri(null)}
        >
          {photoViewerUri && (
            <Image
              source={{ uri: photoViewerUri }}
              style={styles.photoViewerImage}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            style={styles.photoViewerClose}
            onPress={() => setPhotoViewerUri(null)}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
          >
            <X color={colors.text} size={22} />
          </TouchableOpacity>
        </Pressable>
      </Modal>

      <Modal
        visible={editingCatch != null}
        animationType="slide"
        transparent
        onRequestClose={closeEdit}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalOverlay, isWide && styles.modalOverlayWide]}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeEdit} />
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
              <ThemedText style={styles.modalTitle}>Edit Catch</ThemedText>
              <TouchableOpacity
                onPress={closeEdit}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Close edit form"
              >
                <X color={colors.text} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {editingCatch && editInitialValues && (
                <LogCatchForm
                  key={editFormKey}
                  initialValues={editInitialValues}
                  location={editLocation}
                  onSubmit={handleUpdateCatch}
                  saving={updateCatchMutation.isPending}
                  onDirtyChange={setEditDirty}
                />
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
