import { useRouter } from 'expo-router';
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fish, Trophy, Clock } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { getSpeciesRecommendations, getMonthName, getCurrentMonth } from '@/utils/recommendations';
import { getBestTimeNow } from '@/utils/bestTimeNow';
import FishingNowCard from '@/components/map/FishingNowCard';
import { useDeviceLocation } from '@/hooks/useDeviceLocation';
import { useWeather } from '@/hooks/useWeather';
import speciesData from '@/data/species.json';
import { useSaveCatch } from '@/hooks/useCatches';
import LogCatchForm, { type LogCatchFormValues } from '@/components/catch/LogCatchForm';
import { resolveCatchLocationFromDevice } from '@/utils/catchLocation';
import { buildCatchConditions } from '@/utils/catchConditions';
import PersonalInsightsCard from '@/components/map/PersonalInsightsCard';
import { Skeleton, OfflineBanner, useToast, ResponsiveScreen, AppScreenHeader } from '@/components/ui';
import { useNetworkStatus } from '@/providers/NetworkProvider';
import { hapticSuccess, hapticWarning, hapticError } from '@/utils/haptics';
import { useLogFormGuard } from '@/providers/LogFormGuardProvider';
import { useCatchInsights } from '@/hooks/useCatchInsights';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useTheme } from '@/providers/ThemeProvider';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.md,
      marginBottom: Spacing.xs,
    },
    headerTitle: {
      color: colors.text,
      fontSize: FontSizes.xxl,
      fontWeight: FontWeights.bold,
    },
    headerSubtitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.md,
      marginBottom: Spacing.sm,
    },
    timeCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    timeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    timeTitle: {
      color: colors.accent,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
    },
    inlineLoading: {
      paddingVertical: Spacing.sm,
    },
    recommendationSection: {
      marginBottom: Spacing.lg,
    },
    recommendationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    recommendationTitle: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
    },
    recommendationScroll: {
      marginHorizontal: -Spacing.lg,
      paddingHorizontal: Spacing.lg,
    },
    quickRecCard: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      width: 120,
      alignItems: 'center',
      marginRight: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickRecCardWide: {
      flexGrow: 1,
      flexBasis: '23%',
      minWidth: 120,
      maxWidth: 160,
      marginRight: 0,
    },
    recommendationGrid: {
      gap: Spacing.sm,
    },
    recommendationGridWide: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    peakCard: {
      borderColor: colors.accent,
      backgroundColor: colors.cardLight,
    },
    peakBadge: {
      position: 'absolute',
      top: Spacing.xs,
      right: Spacing.xs,
      backgroundColor: colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.xs,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
      gap: 2,
    },
    peakText: {
      color: colors.accentForeground,
      fontSize: 10,
      fontWeight: FontWeights.bold,
    },
    quickRecName: {
      color: colors.text,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      marginTop: Spacing.sm,
      textAlign: 'center',
    },
    quickRecWeight: {
      color: colors.textSecondary,
      fontSize: FontSizes.xs,
      marginTop: Spacing.xs,
    },
    quickRecLure: {
      backgroundColor: colors.accentDark,
      paddingHorizontal: Spacing.xs,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.sm,
      marginTop: Spacing.xs,
      width: '100%',
    },
    quickRecLureText: {
      color: colors.accent,
      fontSize: FontSizes.xs,
      textAlign: 'center',
    },
  });
}

export default function LogScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { isWide } = useResponsiveLayout();
  const [formKey, setFormKey] = useState(0);
  const [initialValues, setInitialValues] = useState<Partial<LogCatchFormValues>>({});
  const { isDirty: formDirty, setDirty: setFormDirty } = useLogFormGuard();
  const { insights } = useCatchInsights();
  const { isOffline } = useNetworkStatus();

  const saveCatchMutation = useSaveCatch();
  const saving = saveCatchMutation.isPending;
  const { showToast } = useToast();

  const { data: deviceLocation, isLoading: locationLoading } = useDeviceLocation();
  const { data: weather, isLoading: weatherLoading } = useWeather(
    deviceLocation?.latitude,
    deviceLocation?.longitude
  );

  const recommendations = useMemo(() => getSpeciesRecommendations(null, null), []);
  const bestTime = useMemo(
    () =>
      getBestTimeNow({
        latitude: deviceLocation?.latitude ?? null,
        longitude: deviceLocation?.longitude ?? null,
        weather: weather ?? null,
      }),
    [deviceLocation?.latitude, deviceLocation?.longitude, weather]
  );

  const logCatchLocation = useMemo(
    () => resolveCatchLocationFromDevice(deviceLocation, locationLoading),
    [deviceLocation, locationLoading]
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
          setFormKey((k) => k + 1);
          setInitialValues({});
          setFormDirty(false);
          if (result.synced) {
            hapticSuccess();
            showToast({
              message: 'Catch logged successfully!',
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
        onError: () => {
          hapticError();
          showToast({ message: 'Failed to save catch. Please try again.', variant: 'error' });
        },
      }
    );
  };

  const applyQuickFill = (rec: { name: string; recommendedLure: string }) => {
    setInitialValues({ species: rec.name, lure: rec.recommendedLure });
    setFormKey((k) => k + 1);
    setFormDirty(false);
  };

  const handleQuickFill = (rec: { name: string; recommendedLure: string }) => {
    if (formDirty) {
      Alert.alert('Replace form contents?', 'Your current entries will be replaced.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', style: 'destructive', onPress: () => applyQuickFill(rec) },
      ]);
      return;
    }
    applyQuickFill(rec);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <ResponsiveScreen>
          <AppScreenHeader
            variant="compact"
            title="Log Catch"
            subtitle="Record your catch"
          />

          {isOffline ? (
            <OfflineBanner message="Catches save on this device and sync automatically when you're back online." />
          ) : null}

          <PersonalInsightsCard
            insights={insights}
            onViewAll={() => router.push('/history')}
          />

          <View style={styles.timeCard}>
            <View style={styles.timeHeader}>
              <Clock color={colors.accent} size={18} />
              <Text style={styles.timeTitle}>Fishing Now</Text>
            </View>
            {locationLoading || weatherLoading ? (
              <View style={styles.inlineLoading}>
                <Skeleton width="100%" height={72} borderRadius={BorderRadius.md} />
              </View>
            ) : (
              <FishingNowCard bestTime={bestTime} weather={weather ?? null} />
            )}
          </View>

          <View style={styles.recommendationSection}>
            <View style={styles.recommendationHeader}>
              <Trophy color={colors.warning} size={18} />
              <Text style={styles.recommendationTitle}>
                Top Catches for {getMonthName(getCurrentMonth())}
              </Text>
            </View>
            <ScrollView
              horizontal={!isWide}
              showsHorizontalScrollIndicator={false}
              style={isWide ? undefined : styles.recommendationScroll}
            >
              <View style={[styles.recommendationGrid, isWide && styles.recommendationGridWide]}>
              {recommendations.map((rec) => (
                <TouchableOpacity
                  key={rec.id}
                  style={[styles.quickRecCard, isWide && styles.quickRecCardWide, rec.isPeak && styles.peakCard]}
                  onPress={() => handleQuickFill(rec)}
                  accessibilityRole="button"
                  accessibilityLabel={`Quick fill ${rec.name}`}
                >
                  {rec.isPeak && (
                    <View style={styles.peakBadge}>
                      <Trophy color={colors.accentForeground} size={10} />
                      <Text style={styles.peakText}>PEAK</Text>
                    </View>
                  )}
                  <Fish color={colors.accent} size={24} />
                  <Text style={styles.quickRecName} numberOfLines={1}>{rec.name}</Text>
                  <Text style={styles.quickRecWeight}>{rec.averageWeight}</Text>
                  <View style={styles.quickRecLure}>
                    <Text style={styles.quickRecLureText} numberOfLines={1}>{rec.recommendedLure}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              </View>
            </ScrollView>
          </View>

          <LogCatchForm
            key={formKey}
            initialValues={initialValues}
            location={logCatchLocation}
            onSubmit={handleSaveCatch}
            saving={saving}
            onDirtyChange={setFormDirty}
          />
          </ResponsiveScreen>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
