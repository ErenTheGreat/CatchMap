import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { Spacing, FontSizes, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import ThemedText from '@/components/ui/ThemedText';
import Button from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorState({
  title = 'Something went wrong',
  message = 'Please check your connection and try again.',
  onRetry,
  retryLabel = 'Try again',
}: ErrorStateProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container} accessibilityRole="alert">
      <AlertCircle color={colors.error} size={48} />
      <ThemedText weight="medium" style={styles.title}>{title}</ThemedText>
      <ThemedText style={styles.message}>{message}</ThemedText>
      {onRetry ? (
        <Button title={retryLabel} onPress={onRetry} variant="secondary" style={styles.retry} />
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.xxl,
      paddingHorizontal: Spacing.lg,
    },
    title: {
      color: colors.text,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.medium,
      marginTop: Spacing.md,
      textAlign: 'center',
    },
    message: {
      color: colors.textSecondary,
      fontSize: FontSizes.md,
      marginTop: Spacing.xs,
      textAlign: 'center',
      lineHeight: 22,
    },
    retry: {
      marginTop: Spacing.lg,
      paddingHorizontal: Spacing.xl,
    },
  });
}
