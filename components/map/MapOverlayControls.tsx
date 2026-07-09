import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Layers, Navigation, SlidersHorizontal } from 'lucide-react-native';
import { Spacing, BorderRadius, type ThemeColors } from '@/constants/theme';
import { BOTTOM_SHEET_PEEK_HEIGHT } from '@/components/map/mapSheetConstants';
import { ThemeToggleButton } from '@/components/ui';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';

interface MapOverlayControlsProps {
  onRecenter: () => void;
  onLayersPress?: () => void;
  mapLayersActive?: boolean;
  recenterDisabled?: boolean;
  showLegend?: boolean;
  onToggleLegend?: () => void;
  bottomOffset?: number;
}

export default function MapOverlayControls({
  onRecenter,
  onLayersPress,
  mapLayersActive = false,
  recenterDisabled = false,
  showLegend = true,
  onToggleLegend,
  bottomOffset = BOTTOM_SHEET_PEEK_HEIGHT,
}: MapOverlayControlsProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [layersActive, setLayersActive] = useState(showLegend);

  useEffect(() => {
    setLayersActive(showLegend);
  }, [showLegend]);

  const handleLayersPress = () => {
    const next = !layersActive;
    setLayersActive(next);
    onToggleLegend?.();
  };

  return (
    <View
      style={[styles.wrapper, { bottom: bottomOffset + Spacing.sm, right: Spacing.sm }]}
      pointerEvents="box-none"
    >
      <ThemeToggleButton size={48} />

      {onLayersPress ? (
        <Pressable
          style={({ pressed }) => [
            styles.fab,
            mapLayersActive && styles.fabActive,
            pressed && styles.fabPressed,
          ]}
          onPress={onLayersPress}
          accessibilityRole="button"
          accessibilityLabel="Map layers: depth contours and weather radar"
        >
          <SlidersHorizontal
            color={mapLayersActive ? colors.accentForeground : colors.text}
            size={22}
          />
        </Pressable>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.fab,
          layersActive && styles.fabActive,
          pressed && styles.fabPressed,
        ]}
        onPress={handleLayersPress}
        accessibilityRole="button"
        accessibilityLabel="Toggle bite activity legend"
      >
        <Layers color={layersActive ? colors.accentForeground : colors.text} size={22} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.fab,
          styles.fabPrimary,
          pressed && styles.fabPressed,
          recenterDisabled && styles.fabDisabled,
        ]}
        onPress={onRecenter}
        disabled={recenterDisabled}
        accessibilityRole="button"
        accessibilityLabel="Recenter on my location"
      >
        <Navigation color={colors.brandAccentForeground} size={22} fill={colors.brandAccentForeground} />
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      position: 'absolute',
      zIndex: 15,
      gap: Spacing.sm,
      alignItems: 'center',
    },
    fab: {
      width: 48,
      height: 48,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.surfaceElevated,
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
    fabPrimary: {
      backgroundColor: colors.brandAccent,
      borderColor: colors.mapPinBorder,
    },
    fabActive: {
      backgroundColor: colors.brandAccent,
      borderColor: colors.mapPinBorder,
    },
    fabPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.96 }],
    },
    fabDisabled: {
      opacity: 0.45,
    },
  });
}
