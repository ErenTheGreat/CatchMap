import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import type { SpeciesRig } from '@/lib/types/speciesRigs';
import RigDiagramCard from '@/components/rigs/RigDiagramCard';
import { Spacing, FontSizes, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';

interface RigListSectionProps {
  rigs: SpeciesRig[];
  compact?: boolean;
  title?: string;
}

export default function RigListSection({
  rigs,
  compact = false,
  title = 'Recommended Rig',
}: RigListSectionProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [expanded, setExpanded] = useState(false);

  if (rigs.length === 0) return null;

  const primary = rigs.find((rig) => rig.isPrimary) ?? rigs[0];
  const alternates = rigs.filter((rig) => rig.id !== primary.id);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <RigDiagramCard rig={primary} compact={compact} />

      {alternates.length > 0 ? (
        <>
          <Pressable
            style={styles.toggle}
            onPress={() => setExpanded((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={
              expanded
                ? `Hide ${alternates.length} alternate rigs`
                : `Show ${alternates.length} more rigs`
            }
            accessibilityState={{ expanded }}
          >
            <Text style={styles.toggleText}>
              More rigs ({alternates.length})
            </Text>
            {expanded ? (
              <ChevronUp color={colors.accent} size={16} />
            ) : (
              <ChevronDown color={colors.accent} size={16} />
            )}
          </Pressable>

          {expanded
            ? alternates.map((rig) => (
                <RigDiagramCard key={rig.id} rig={rig} compact={compact} />
              ))
            : null}
        </>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: {
      marginTop: Spacing.sm,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      marginBottom: Spacing.xs,
    },
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.sm,
      marginTop: Spacing.xs,
    },
    toggleText: {
      color: colors.accent,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
  });
}
