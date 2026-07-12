import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, type TextInputProps } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { useAppFontFamily } from '@/hooks/useAppFontFamily';

interface SearchFieldProps extends Omit<TextInputProps, 'style'> {
  value: string;
  onChangeText: (text: string) => void;
  containerStyle?: object;
}

export default function SearchField({
  value,
  onChangeText,
  placeholder = 'Search…',
  accessibilityLabel = 'Search',
  containerStyle,
  ...inputProps
}: SearchFieldProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const fontFamily = useAppFontFamily('regular');

  return (
    <View style={[styles.container, containerStyle]}>
      <Search color={colors.textMuted} size={18} />
      <TextInput
        style={[styles.input, fontFamily ? { fontFamily } : null]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        clearButtonMode="never"
        maxFontSizeMultiplier={1.5}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="search"
        {...inputProps}
      />
      {value.length > 0 ? (
        <TouchableOpacity
          onPress={() => onChangeText('')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <X color={colors.textMuted} size={16} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: Spacing.sm,
      minHeight: 44,
    },
    input: {
      flex: 1,
      color: colors.text,
      fontSize: FontSizes.md,
      paddingVertical: Spacing.sm,
    },
  });
}
