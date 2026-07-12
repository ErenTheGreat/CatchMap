import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Navigation } from 'lucide-react-native';
import { Spacing, BorderRadius, type ThemeColors } from '@/constants/theme';
import { BOTTOM_SHEET_PEEK_HEIGHT } from '@/components/map/mapSheetConstants';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';

interface MapRecenterButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export default function MapRecenterButton({ onPress, disabled = false }: MapRecenterButtonProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          disabled && styles.buttonDisabled,
        ]}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Recenter on my location"
      >
        <Navigation color={colors.accentForeground} size={22} fill={colors.accentForeground} />
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      position: 'absolute',
      right: Spacing.sm,
      bottom: BOTTOM_SHEET_PEEK_HEIGHT + Spacing.sm,
      zIndex: 15,
    },
    button: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 8,
      borderWidth: 2,
      borderColor: colors.mapPinBorder,
    },
    buttonPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.96 }],
    },
    buttonDisabled: {
      opacity: 0.45,
    },
  });
}
