import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MapPin, Trash2 } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import type { WaypointRecord } from '@/lib/types/waypoint';
import { hapticLight } from '@/utils/haptics';

interface WaypointsSectionProps {
  waypoints: WaypointRecord[];
  onWaypointPress: (waypoint: WaypointRecord) => void;
  onDeleteWaypoint?: (waypointId: string) => void;
}

export default function WaypointsSection({
  waypoints,
  onWaypointPress,
  onDeleteWaypoint,
}: WaypointsSectionProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (waypoints.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <MapPin color={colors.textMuted} size={16} />
        <Text style={styles.emptyText}>
          Long-press the map to save a private waypoint. Your secret spots stay private.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {waypoints.slice(0, 8).map((waypoint) => (
        <TouchableOpacity
          key={waypoint.id}
          style={styles.card}
          onPress={() => {
            hapticLight();
            onWaypointPress(waypoint);
          }}
          activeOpacity={0.75}
        >
          <View style={styles.iconWrap}>
            <MapPin color="#EAB308" size={16} fill="#EAB308" />
          </View>
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>
              {waypoint.name}
            </Text>
            {waypoint.notes ? (
              <Text style={styles.notes} numberOfLines={2}>
                {waypoint.notes}
              </Text>
            ) : (
              <Text style={styles.coords}>
                {waypoint.latitude.toFixed(4)}, {waypoint.longitude.toFixed(4)}
              </Text>
            )}
          </View>
          {onDeleteWaypoint ? (
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                onDeleteWaypoint(waypoint.id);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Delete waypoint ${waypoint.name}`}
            >
              <Trash2 color={colors.textMuted} size={16} />
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: {
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: BorderRadius.full,
      backgroundColor: colors.cardLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: {
      flex: 1,
      gap: 2,
    },
    name: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
    },
    notes: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
    },
    coords: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
    },
    emptyCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Spacing.md,
    },
    emptyText: {
      flex: 1,
      color: colors.textMuted,
      fontSize: FontSizes.sm,
      lineHeight: 20,
    },
  });
}
