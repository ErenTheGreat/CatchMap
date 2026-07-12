import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import {
  FontSizes,
  FontWeights,
  FontFamily,
  BRAND_TAGLINE,
  Spacing,
  type ThemeColors,
} from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useFontsReady } from '@/providers/FontProvider';
import { useTheme } from '@/providers/ThemeProvider';

export type BrandMarkSize = 'sm' | 'md' | 'lg';

interface BrandMarkProps {
  size?: BrandMarkSize;
  showTagline?: boolean;
  /** When true, wordmark and tagline use light colors for navy hero backgrounds. */
  onDarkBackground?: boolean;
  /** Icon only — for narrow sidebars. */
  iconOnly?: boolean;
}

const ICON_SIZES: Record<BrandMarkSize, number> = {
  sm: 24,
  md: 32,
  lg: 48,
};

const WORDMARK_SIZES: Record<BrandMarkSize, number> = {
  sm: FontSizes.lg,
  md: FontSizes.xl,
  lg: FontSizes.xxxl,
};

export default function BrandMark({
  size = 'md',
  showTagline = false,
  onDarkBackground = false,
  iconOnly = false,
}: BrandMarkProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const fontsReady = useFontsReady();
  const iconSize = ICON_SIZES[size];
  const wordmarkSize = WORDMARK_SIZES[size];

  const wordmarkColor = onDarkBackground ? '#FFFFFF' : colors.brandNavy;
  const taglineColor = onDarkBackground ? 'rgba(255,255,255,0.75)' : colors.textSecondary;

  if (iconOnly) {
    return (
      <Image
        source={require('@/assets/images/icon.png')}
        style={{ width: iconSize, height: iconSize, borderRadius: iconSize * 0.22 }}
        accessibilityIgnoresInvertColors
        accessibilityLabel="CatchMap"
      />
    );
  }

  return (
    <View style={styles.container} accessibilityRole="header" accessibilityLabel="CatchMap">
      <Image
        source={require('@/assets/images/icon.png')}
        style={{ width: iconSize, height: iconSize, borderRadius: iconSize * 0.22 }}
        accessibilityIgnoresInvertColors
      />
      <View style={styles.textBlock}>
        <Text
          style={[
            styles.wordmark,
            { fontSize: wordmarkSize, color: wordmarkColor },
            fontsReady && { fontFamily: FontFamily.brand },
          ]}
        >
          CatchMap
        </Text>
        {showTagline ? (
          <Text
            style={[
              styles.tagline,
              { color: taglineColor },
              fontsReady && { fontFamily: FontFamily.regular },
            ]}
          >
            {BRAND_TAGLINE}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    textBlock: {
      flexShrink: 1,
    },
    wordmark: {
      fontWeight: FontWeights.bold,
      letterSpacing: -0.3,
    },
    tagline: {
      fontSize: FontSizes.sm,
      marginTop: 2,
    },
  });
}
