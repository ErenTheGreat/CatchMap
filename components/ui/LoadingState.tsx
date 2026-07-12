import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Spacing, FontSizes, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import ThemedText from '@/components/ui/ThemedText';

interface LoadingStateProps {
  message?: string;
  compact?: boolean;
}

export default function LoadingState({ message = 'Loading…', compact = false }: LoadingStateProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View
      style={[styles.container, compact && styles.compact]}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
    >
      <ActivityIndicator color={colors.accent} size={compact ? 'small' : 'large'} />
      <ThemedText style={styles.message}>{message}</ThemedText>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.lg,
    },
    compact: {
      flex: 0,
      paddingVertical: Spacing.xl,
    },
    message: {
      color: colors.textSecondary,
      fontSize: FontSizes.md,
    },
  });
}
