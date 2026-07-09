import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Switch, ActivityIndicator } from 'react-native';
import { Layers, X } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import type { MapLayerState } from '@/lib/mapLayers/config';
import type { BiteHeatmapStatus } from '@/utils/biteHeatmap';

interface MapLayerSheetProps {
  visible: boolean;
  layers: MapLayerState;
  radarLoading?: boolean;
  radarError?: string | null;
  heatmapStatus?: BiteHeatmapStatus;
  onToggle: (layer: keyof MapLayerState) => void;
  onClose: () => void;
}

function getRadarSubtitle(
  layers: MapLayerState,
  radarLoading: boolean,
  radarError: string | null
): string {
  if (!layers.radar) {
    return 'Live precipitation from RainViewer (transparent when dry)';
  }
  if (radarLoading) return 'Loading latest frame…';
  if (radarError) return radarError;
  return 'Live precipitation from RainViewer (transparent when dry)';
}

function getHeatmapSubtitle(
  layers: MapLayerState,
  heatmapStatus: BiteHeatmapStatus
): string {
  if (!layers.heatmap) {
    return 'Colored glow on water fishing spots only';
  }
  if (heatmapStatus === 'no_scores') return 'Waiting for spot scores…';
  if (heatmapStatus === 'needs_more_spots') {
    return 'Need at least 3 scored water spots in view';
  }
  return 'Colored glow on water fishing spots only';
}

export default function MapLayerSheet({
  visible,
  layers,
  radarLoading = false,
  radarError = null,
  heatmapStatus = 'ready',
  onToggle,
  onClose,
}: MapLayerSheetProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Layers color={colors.accent} size={18} />
              <Text style={styles.title}>Map Layers</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close layers">
              <X color={colors.textMuted} size={20} />
            </Pressable>
          </View>

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Depth contours</Text>
              <Text style={styles.rowSubtitle}>
                Coastal NOAA bathymetry (zoom out to see; not street-level)
              </Text>
            </View>
            <Switch
              value={layers.depth}
              onValueChange={() => onToggle('depth')}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.card}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Weather radar</Text>
              <Text style={styles.rowSubtitle}>
                {getRadarSubtitle(layers, radarLoading, radarError)}
              </Text>
            </View>
            <View style={styles.rowControls}>
              {radarLoading && layers.radar ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : null}
              <Switch
                value={layers.radar}
                onValueChange={() => onToggle('radar')}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.card}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Community activity</Text>
              <Text style={styles.rowSubtitle}>
                Highlight spots where anglers have logged catches nearby
              </Text>
            </View>
            <Switch
              value={layers.community}
              onValueChange={() => onToggle('community')}
              trackColor={{ false: colors.border, true: colors.community }}
              thumbColor={colors.card}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Bite probability heatmap</Text>
              <Text style={styles.rowSubtitle}>
                {getHeatmapSubtitle(layers, heatmapStatus)}
              </Text>
            </View>
            <Switch
              value={layers.heatmap}
              onValueChange={() => onToggle('heatmap')}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.card}
            />
          </View>

          <Text style={styles.note}>
            Layers are off by default. Depth works best zoomed out near the coast. Heatmap shows a
            continuous bite field — pin colors still show per-spot scores.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    title: {
      color: colors.text,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.semibold,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      paddingVertical: Spacing.xs,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    rowControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    rowTitle: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.medium,
    },
    rowSubtitle: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      lineHeight: 16,
    },
    note: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      lineHeight: 18,
    },
  });
}
