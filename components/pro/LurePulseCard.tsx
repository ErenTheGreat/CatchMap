import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Fish } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import ProUpsellCard from '@/components/pro/ProUpsellCard';
import { isLurePulseEnabled } from '@/constants/features';
import type { CatchActivityRow } from '@/lib/types/speciesPrediction';
import type { NearbySpot } from '@/utils/recommendations';
import { aggregateTrendingLures } from '@/utils/lurePulse';

interface LurePulseCardProps {
  communityBySpotId: Record<string, CatchActivityRow[]>;
  spots: NearbySpot[];
}

export default function LurePulseCard({ communityBySpotId, spots }: LurePulseCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const spotNamesById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const spot of spots) {
      map[spot.id] = spot.name;
    }
    return map;
  }, [spots]);

  const summary = useMemo(
    () => aggregateTrendingLures(communityBySpotId, spotNamesById),
    [communityBySpotId, spotNamesById]
  );

  if (!isLurePulseEnabled()) {
    return (
      <ProUpsellCard
        compact
        title="Lure Pulse"
        description="See what lures are actually catching fish near you this week."
      />
    );
  }

  if (summary.trending.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Fish color={colors.community} size={18} />
        <Text style={styles.title}>Lure Pulse</Text>
      </View>
      <Text style={styles.hint}>Trending in your viewport (last 90 days).</Text>
      {summary.trending.map((item) => (
        <View key={item.lure} style={styles.row}>
          <Text style={styles.lure} numberOfLines={1}>
            {item.lure}
          </Text>
          <Text style={styles.meta}>
            {item.spotCount} spot{item.spotCount === 1 ? '' : 's'}
            {item.topSpotName ? ` · hot at ${item.topSpotName}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: Spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    title: {
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      color: colors.text,
    },
    hint: {
      fontSize: FontSizes.sm,
      color: colors.textSecondary,
    },
    row: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: Spacing.sm,
      gap: 2,
    },
    lure: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      color: colors.text,
    },
    meta: {
      fontSize: FontSizes.xs,
      color: colors.community,
    },
  });
}
