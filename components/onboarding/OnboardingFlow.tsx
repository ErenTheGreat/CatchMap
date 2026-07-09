import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  TouchableOpacity,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Fish, Clock, Navigation } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { Button } from '@/components/ui';
import BrandMark from '@/components/brand/BrandMark';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { useOnboarding } from '@/providers/OnboardingProvider';
import { hapticLight } from '@/utils/haptics';

interface Slide {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export default function OnboardingFlow() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { markComplete } = useOnboarding();
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [requesting, setRequesting] = useState(false);

  const slides: Slide[] = [
    {
      icon: <MapPin color={colors.accent} size={64} />,
      title: 'Discover fishing spots',
      description:
        'Explore thousands of spots near you with live species predictions, tides, and weather right on the map.',
    },
    {
      icon: <Fish color={colors.accent} size={64} />,
      title: 'Log every catch',
      description:
        'Record species, weight, length, and a photo — plus the exact conditions you caught them in.',
    },
    {
      icon: <Clock color={colors.accent} size={64} />,
      title: 'Know the best time',
      description:
        'Solunar and weather-powered bite forecasts show you when the fish are most likely to be active.',
    },
  ];

  const isLast = index === slides.length - 1;

  const goToIndex = (next: number) => {
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };

  const handleNext = () => {
    hapticLight();
    if (!isLast) {
      goToIndex(index + 1);
    }
  };

  const finish = () => {
    queryClient.invalidateQueries({ queryKey: ['deviceLocation'] });
    markComplete();
  };

  const handleEnableLocation = async () => {
    hapticLight();
    setRequesting(true);
    try {
      await Location.requestForegroundPermissionsAsync();
    } catch (error) {
      if (__DEV__) console.warn('[onboarding] location permission request failed:', error);
      // Permission errors shouldn't block finishing onboarding.
    } finally {
      setRequesting(false);
      finish();
    }
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <BrandMark size="md" showTagline />
        <TouchableOpacity
          onPress={finish}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
        >
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.pager}
      >
        {slides.map((slide) => (
          <View key={slide.title} style={[styles.slide, { width }]}>
            <View style={styles.iconCircle}>{slide.icon}</View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.description}>{slide.description}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((slide, i) => (
            <View
              key={slide.title}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>

        {isLast ? (
          <View style={styles.finishBlock}>
            <View style={styles.permissionCard}>
              <Navigation color={colors.accent} size={20} />
              <Text style={styles.permissionText}>
                Allow location to center the map on you and tailor species predictions to
                where you fish.
              </Text>
            </View>
            <Button
              title="Enable location & finish"
              onPress={handleEnableLocation}
              loading={requesting}
              accessibilityLabel="Enable location and finish onboarding"
            />
            <TouchableOpacity
              onPress={finish}
              style={styles.laterButton}
              accessibilityRole="button"
              accessibilityLabel="Continue without location"
            >
              <Text style={styles.laterText}>Not now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Button title="Next" onPress={handleNext} accessibilityLabel="Next slide" />
        )}
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.md,
      gap: Spacing.md,
    },
    skip: {
      color: colors.textSecondary,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
    },
    pager: {
      flex: 1,
    },
    slide: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
    },
    iconCircle: {
      width: 128,
      height: 128,
      borderRadius: 64,
      backgroundColor: colors.cardLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.xl,
    },
    title: {
      color: colors.text,
      fontSize: FontSizes.xxl,
      fontWeight: FontWeights.bold,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    description: {
      color: colors.textSecondary,
      fontSize: FontSizes.md,
      lineHeight: 24,
      textAlign: 'center',
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.lg,
      gap: Spacing.lg,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.xs,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: {
      backgroundColor: colors.accent,
      width: 24,
    },
    finishBlock: {
      gap: Spacing.md,
    },
    permissionCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
    },
    permissionText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      lineHeight: 20,
    },
    laterButton: {
      alignItems: 'center',
      paddingVertical: Spacing.sm,
    },
    laterText: {
      color: colors.textSecondary,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.medium,
    },
  });
}
