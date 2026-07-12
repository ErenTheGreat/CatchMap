import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Spacing, FontSizes, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import ThemedText from '@/components/ui/ThemedText';
import Button from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      {icon}
      <ThemedText weight="medium" style={styles.title}>{title}</ThemedText>
      {subtitle ? <ThemedText style={styles.subtitle}>{subtitle}</ThemedText> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} variant="secondary" style={styles.action} />
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.xxl * 2,
      paddingHorizontal: Spacing.lg,
    },
    title: {
      color: colors.text,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.medium,
      marginTop: Spacing.lg,
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.md,
      marginTop: Spacing.xs,
      textAlign: 'center',
    },
    action: {
      marginTop: Spacing.lg,
      paddingHorizontal: Spacing.xl,
    },
  });
}
