import React from 'react';
import { View, TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { useAppFontFamily } from '@/hooks/useAppFontFamily';
import ThemedText from '@/components/ui/ThemedText';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  required?: boolean;
}

export default function TextField({
  label,
  error,
  required,
  style,
  ...inputProps
}: TextFieldProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const fontFamily = useAppFontFamily('regular');

  return (
    <View style={styles.container}>
      {label ? (
        <ThemedText weight="medium" style={styles.label}>
          {label}
          {required ? ' *' : ''}
        </ThemedText>
      ) : null}
      <TextInput
        style={[styles.input, fontFamily ? { fontFamily } : null, error ? styles.inputError : null, style]}
        placeholderTextColor={colors.textMuted}
        maxFontSizeMultiplier={1.5}
        accessibilityLabel={label}
        {...inputProps}
      />
      {error ? (
        <ThemedText style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: Spacing.md,
    },
    label: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.medium,
      marginBottom: Spacing.xs,
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      color: colors.text,
      fontSize: FontSizes.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputError: {
      borderColor: colors.error,
    },
    error: {
      color: colors.error,
      fontSize: FontSizes.sm,
      marginTop: Spacing.xs,
    },
  });
}
