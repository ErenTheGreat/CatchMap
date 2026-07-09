import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { Bookmark, Clock, Navigation } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import {
  snapshotFromRecent,
  type RecentSpotSnapshot,
  type SavedSpotSnapshot,
} from '@/lib/types/savedSpot';
import { getWaterTypeIcon } from '@/utils/recommendations';
import { openSpotInMaps } from '@/utils/openSpotInMaps';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { hapticLight } from '@/utils/haptics';

interface SavedSpotsSectionProps {
  savedSpots: SavedSpotSnapshot[];
  recentSpots: RecentSpotSnapshot[];
  onSpotPress: (snapshot: SavedSpotSnapshot) => void;
  selectedSpotId?: string | null;
}

function SpotChip({
  snapshot,
  isSelected,
  onPress,
  onNavigate,
  styles,
  colors,
  icon,
}: {
  snapshot: SavedSpotSnapshot;
  isSelected: boolean;
  onPress: () => void;
  onNavigate: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  icon: React.ReactNode;
}) {
  return (
    <View style={[styles.chip, isSelected && styles.chipSelected]}>
      <TouchableOpacity
        style={styles.chipMain}
        onPress={onPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`Open ${snapshot.name} on map`}
      >
        <View style={styles.chipIcon}>{icon}</View>
        <Text style={styles.chipName} numberOfLines={2}>
          {snapshot.name}
        </Text>
        <Text style={styles.chipMeta}>{getWaterTypeIcon(snapshot.water_type)}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.navigateButton}
        onPress={onNavigate}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`Navigate to ${snapshot.name}`}
      >
        <Navigation color={colors.accent} size={16} />
      </TouchableOpacity>
    </View>
  );
}

export default function SavedSpotsSection({
  savedSpots,
  recentSpots,
  onSpotPress,
  selectedSpotId = null,
}: SavedSpotsSectionProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const savedIds = new Set(savedSpots.map((spot) => spot.id));
  const recentOnly = recentSpots
    .filter((spot) => !savedIds.has(spot.id))
    .map(snapshotFromRecent);

  const handleNavigate = useCallback(async (snapshot: SavedSpotSnapshot) => {
    hapticLight();
    await openSpotInMaps({
      latitude: snapshot.latitude,
      longitude: snapshot.longitude,
      name: snapshot.name,
    });
  }, []);

  const renderSaved = useCallback(
    ({ item }: { item: SavedSpotSnapshot }) => (
      <SpotChip
        snapshot={item}
        isSelected={item.id === selectedSpotId}
        onPress={() => onSpotPress(item)}
        onNavigate={() => void handleNavigate(item)}
        styles={styles}
        colors={colors}
        icon={<Bookmark color={colors.accent} size={14} fill={colors.accent} />}
      />
    ),
    [colors, handleNavigate, onSpotPress, selectedSpotId, styles]
  );

  const renderRecent = useCallback(
    ({ item }: { item: SavedSpotSnapshot }) => (
      <SpotChip
        snapshot={item}
        isSelected={item.id === selectedSpotId}
        onPress={() => onSpotPress(item)}
        onNavigate={() => void handleNavigate(item)}
        styles={styles}
        colors={colors}
        icon={<Clock color={colors.textMuted} size={14} />}
      />
    ),
    [colors, handleNavigate, onSpotPress, selectedSpotId, styles]
  );

  if (savedSpots.length === 0 && recentOnly.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {savedSpots.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My waters</Text>
          <FlatList
            horizontal
            data={savedSpots}
            keyExtractor={(item) => `saved-${item.id}`}
            renderItem={renderSaved}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.list}
            nestedScrollEnabled
          />
        </View>
      ) : null}

      {recentOnly.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recently viewed</Text>
          <FlatList
            horizontal
            data={recentOnly}
            keyExtractor={(item) => `recent-${item.id}`}
            renderItem={renderRecent}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.list}
            nestedScrollEnabled
          />
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      paddingBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    section: {
      gap: Spacing.xs,
    },
    sectionTitle: {
      paddingHorizontal: Spacing.md,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    list: {
      paddingHorizontal: Spacing.md,
      gap: Spacing.sm,
    },
    chip: {
      width: 148,
      flexDirection: 'row',
      alignItems: 'stretch',
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    chipSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.card,
    },
    chipMain: {
      flex: 1,
      padding: Spacing.sm,
      gap: 4,
    },
    chipIcon: {
      marginBottom: 2,
    },
    chipName: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      color: colors.text,
      minHeight: 36,
    },
    chipMeta: {
      fontSize: FontSizes.xs,
      color: colors.textMuted,
    },
    navigateButton: {
      width: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.border,
      backgroundColor: colors.card,
    },
  });
}
