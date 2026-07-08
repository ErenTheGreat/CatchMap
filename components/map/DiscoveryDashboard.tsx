import React, { useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
// Gesture-handler FlatList so horizontal swipes don't fight the sheet's pan gesture.
import { FlatList } from 'react-native-gesture-handler';
import { Anchor, Search, Waves, ZoomIn } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import type { CategorizedSpotsResponse } from '@/lib/types/categorizedSpots';
import type { NearbySpot } from '@/utils/recommendations';
import { formatDistance, getWaterTypeIcon } from '@/utils/recommendations';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';

export type DiscoveryDashboardStatus =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'offline-empty'
  | 'zoom-out'
  | 'waiting-for-map';

interface DiscoveryDashboardProps {
  categories: CategorizedSpotsResponse;
  status: DiscoveryDashboardStatus;
  onSpotPress: (spot: NearbySpot) => void;
  /** Highlights the card matching the map's selected pin. */
  selectedSpotId?: string | null;
  usingCachedDiscovery?: boolean;
}

const CARD_WIDTH = 168;

function DiscoveryDashboard({
  categories,
  status,
  onSpotPress,
  selectedSpotId = null,
  usingCachedDiscovery = false,
}: DiscoveryDashboardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const renderSpotCard = useCallback(
    ({ item }: { item: NearbySpot }) => {
      const isSelected = item.id === selectedSpotId;
      return (
        <TouchableOpacity
          style={[styles.spotCard, isSelected && styles.spotCardSelected]}
          onPress={() => onSpotPress(item)}
          activeOpacity={0.75}
        >
          <View style={styles.spotIcon}>
            <Anchor color={colors.accent} size={18} />
          </View>
          <Text style={styles.spotName} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={styles.spotMeta}>
            <Waves color={colors.textMuted} size={12} />
            <Text style={styles.spotType}>{getWaterTypeIcon(item.water_type)}</Text>
          </View>
          <Text style={styles.spotDistance}>{formatDistance(item.distance)}</Text>
        </TouchableOpacity>
      );
    },
    [onSpotPress, selectedSpotId, styles, colors.accent, colors.textMuted]
  );

  const spotKeyExtractor = useCallback((item: NearbySpot) => item.id, []);

  if (status === 'waiting-for-map' || status === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} size="small" />
        <Text style={styles.loadingText}>
          {status === 'waiting-for-map'
            ? 'Loading map view…'
            : 'Loading waters in view…'}
        </Text>
      </View>
    );
  }

  if (status === 'zoom-out') {
    return (
      <View style={styles.emptyContainer}>
        <ZoomIn color={colors.accent} size={36} />
        <Text style={styles.emptyTitle}>Zoom in to see spots</Text>
        <Text style={styles.emptySubtitle}>
          The map is showing too large an area. Pinch to zoom in, then browse
          waters in the visible region.
        </Text>
      </View>
    );
  }

  if (status === 'offline-empty') {
    return (
      <View style={styles.emptyContainer}>
        <Search color={colors.textMuted} size={32} />
        <Text style={styles.emptyTitle}>No saved waters in this view</Text>
        <Text style={styles.emptySubtitle}>
          Connect briefly while viewing this area to cache lakes and creeks for offline
          use. Curated Bay Area spots still appear when you are near them.
        </Text>
      </View>
    );
  }

  if (status === 'empty') {
    return (
      <View style={styles.emptyContainer}>
        <Search color={colors.textMuted} size={32} />
        <Text style={styles.emptyTitle}>No waters in this view</Text>
        <Text style={styles.emptySubtitle}>
          Pan or zoom the map to explore a different region, or search for a
          location by name.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Waters in View</Text>
        <Text style={styles.headerSubtitle}>
          {usingCachedDiscovery
            ? 'Saved discovery data — reconnect for live updates'
            : 'Browse by category anywhere on the map'}
        </Text>
      </View>

      {categories.map((group) => (
        <View key={group.category} style={styles.categorySection}>
          <Text style={styles.categoryTitle}>{group.category}</Text>
          <FlatList
            horizontal
            data={group.spots}
            keyExtractor={spotKeyExtractor}
            renderItem={renderSpotCard}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            nestedScrollEnabled
          />
        </View>
      ))}
    </View>
  );
}

export default memo(DiscoveryDashboard);

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      paddingBottom: Spacing.md,
    },
    header: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    headerTitle: {
      color: colors.text,
      fontSize: FontSizes.xl,
      fontWeight: FontWeights.bold,
    },
    headerSubtitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      marginTop: 4,
    },
    categorySection: {
      marginTop: Spacing.md,
    },
    categoryTitle: {
      color: colors.text,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.semibold,
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.sm,
    },
    horizontalList: {
      paddingHorizontal: Spacing.md,
      gap: Spacing.sm,
    },
    spotCard: {
      width: CARD_WIDTH,
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    spotCardSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accentDark,
    },
    spotIcon: {
      backgroundColor: colors.accentDark,
      alignSelf: 'flex-start',
      padding: Spacing.sm,
      borderRadius: BorderRadius.md,
      marginBottom: Spacing.sm,
    },
    spotName: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      minHeight: 40,
    },
    spotMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.xs,
    },
    spotType: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
    },
    spotDistance: {
      color: colors.accent,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      marginTop: Spacing.sm,
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      padding: Spacing.xl,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: FontSizes.md,
    },
    emptyContainer: {
      alignItems: 'center',
      padding: Spacing.xl,
      paddingHorizontal: Spacing.lg,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.semibold,
      marginTop: Spacing.sm,
    },
    emptySubtitle: {
      color: colors.textMuted,
      fontSize: FontSizes.sm,
      textAlign: 'center',
      marginTop: Spacing.xs,
      lineHeight: 20,
    },
  });
}
