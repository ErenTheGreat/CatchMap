import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Spacing,
  FontSizes,
  BorderRadius,
  FontWeights,
  FontFamily,
  BRAND_TAGLINE,
  type ThemeColors,
} from '@/constants/theme';
import BrandMark from '@/components/brand/BrandMark';
import SettingsButton from '@/components/ui/SettingsButton';
import ThemeToggleButton from '@/components/ui/ThemeToggleButton';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useFontsReady } from '@/providers/FontProvider';
import { useTheme } from '@/providers/ThemeProvider';

export type HeroCollapseLevel = 'full' | 'compact' | 'minimal';

interface AppScreenHeaderBaseProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

interface CompactHeaderProps extends AppScreenHeaderBaseProps {
  variant: 'compact';
}

interface HeroHeaderProps extends AppScreenHeaderBaseProps {
  variant: 'hero';
  collapseLevel?: HeroCollapseLevel;
  children?: React.ReactNode;
  onLayout?: (height: number) => void;
}

export type AppScreenHeaderProps = CompactHeaderProps | HeroHeaderProps;

const HERO_BRAND_ROW = 44;
const HERO_TAGLINE = 18;
const HERO_SEARCH = 48;
const HERO_PADDING = Spacing.md;

function HeroHeader({
  collapseLevel = 'full',
  children,
  actions,
  onLayout,
}: HeroHeaderProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const fontsReady = useFontsReady();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(1)).current;

  const showTagline = collapseLevel === 'full';
  const brandSize = collapseLevel === 'minimal' ? 'sm' : collapseLevel === 'compact' ? 'sm' : 'md';

  useEffect(() => {
    Animated.timing(anim, {
      toValue: collapseLevel === 'full' ? 1 : collapseLevel === 'compact' ? 0.6 : 0.3,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [anim, collapseLevel]);

  const taglineOpacity = anim.interpolate({
    inputRange: [0.3, 0.6, 1],
    outputRange: [0, 0, 1],
  });

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;
      onLayout?.(height);
    },
    [onLayout]
  );

  return (
    <View
      style={[styles.heroWrapper, { paddingTop: insets.top + Spacing.sm }]}
      onLayout={handleLayout}
      pointerEvents="box-none"
    >
      <LinearGradient
        colors={[colors.brandNavy, colors.heroGradientEnd]}
        style={styles.heroGradient}
        pointerEvents="box-none"
      >
        <View style={styles.heroTopRow}>
          <BrandMark
            size={brandSize}
            showTagline={false}
            onDarkBackground
          />
          <View style={styles.heroActions}>
            {actions ?? (
              <>
                <SettingsButton variant="onDark" />
                <ThemeToggleButton variant="onDark" />
              </>
            )}
          </View>
        </View>

        <Animated.Text
          style={[
            styles.heroTagline,
            fontsReady ? { fontFamily: FontFamily.regular } : null,
            {
              opacity: taglineOpacity,
              maxHeight: showTagline ? HERO_TAGLINE + 4 : 0,
              marginTop: showTagline ? Spacing.xs : 0,
            },
          ]}
          numberOfLines={1}
        >
          {BRAND_TAGLINE}
        </Animated.Text>

        <View style={styles.heroSearchSlot}>{children}</View>
      </LinearGradient>
    </View>
  );
}

function CompactHeader({ title, subtitle, actions }: CompactHeaderProps) {
  const styles = useThemedStyles(createStyles);
  const fontsReady = useFontsReady();

  return (
    <View style={styles.compactWrapper}>
      <View style={styles.compactMain}>
        <BrandMark size="sm" />
        {(title || subtitle) ? (
          <View style={styles.compactText}>
            {title ? (
              <Text style={[styles.compactTitle, fontsReady && { fontFamily: FontFamily.medium }]}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text style={[styles.compactSubtitle, fontsReady && { fontFamily: FontFamily.regular }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      {actions ? <View style={styles.compactActions}>{actions}</View> : null}
    </View>
  );
}

export default function AppScreenHeader(props: AppScreenHeaderProps) {
  if (props.variant === 'hero') {
    return <HeroHeader {...props} />;
  }
  return <CompactHeader {...props} />;
}

/** Approximate hero header height for banner positioning before onLayout fires. */
export function estimateHeroHeaderHeight(
  collapseLevel: HeroCollapseLevel,
  safeAreaTop: number
): number {
  const showTagline = collapseLevel === 'full';
  const brandRow = collapseLevel === 'minimal' ? 32 : HERO_BRAND_ROW;
  return (
    safeAreaTop +
    HERO_PADDING +
    brandRow +
    (showTagline ? HERO_TAGLINE + Spacing.xs : 0) +
    HERO_SEARCH +
    HERO_PADDING
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    heroWrapper: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 25,
    },
    heroGradient: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.md,
      borderBottomLeftRadius: BorderRadius.xl,
      borderBottomRightRadius: BorderRadius.xl,
      shadowColor: colors.brandNavy,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 10,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    heroTagline: {
      fontSize: FontSizes.sm,
      color: 'rgba(255,255,255,0.75)',
      overflow: 'hidden',
    },
    heroSearchSlot: {
      marginTop: Spacing.sm,
    },
    compactWrapper: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    compactMain: {
      flex: 1,
      gap: Spacing.xs,
    },
    compactText: {
      marginTop: Spacing.xs,
    },
    compactTitle: {
      color: colors.text,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.semibold,
    },
    compactSubtitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      marginTop: 2,
    },
    compactActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
  });
}
