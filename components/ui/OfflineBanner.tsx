import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';

interface OfflineBannerProps {
  title?: string;
  message?: string;
  compact?: boolean;
}

export default function OfflineBanner({
  title = "You're offline",
  message = 'Showing saved data where available. New lookups will resume when you reconnect.',
  compact = false,
}: OfflineBannerProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.banner, compact && styles.bannerCompact]} accessibilityRole="text">
      <WifiOff color={colors.toastWarning} size={compact ? 14 : 16} />
      <View style={styles.textBlock}>
        <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
        {!compact ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      backgroundColor: colors.warningSurface,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: colors.toastWarning,
      padding: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    bannerCompact: {
      alignItems: 'center',
      marginBottom: Spacing.xs,
    },
    textBlock: {
      flex: 1,
      gap: 2,
    },
    title: {
      color: colors.text,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
    },
    titleCompact: {
      fontSize: FontSizes.xs,
    },
    message: {
      color: colors.textSecondary,
      fontSize: FontSizes.xs,
      lineHeight: 16,
    },
  });
}
