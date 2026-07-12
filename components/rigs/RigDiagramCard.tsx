import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ChevronRight, Star } from 'lucide-react-native';
import type { SpeciesRig, RigComponentRole } from '@/lib/types/speciesRigs';
import { getRigTypeLabel } from '@/utils/speciesRigs';
import RigComponentIcon from '@/components/rigs/RigComponentIcon';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';

interface RigDiagramCardProps {
  rig: SpeciesRig;
  compact?: boolean;
}

const MAINLINE_ROLES: RigComponentRole[] = ['rod', 'reel', 'line', 'leader', 'swivel'];
const TERMINAL_ROLES: RigComponentRole[] = ['hook', 'weight', 'lure', 'bait', 'float', 'other'];

function partitionComponents(components: SpeciesRig['components']) {
  const mainline = components.filter((c) => MAINLINE_ROLES.includes(c.role));
  const terminal = components.filter((c) => TERMINAL_ROLES.includes(c.role));
  return { mainline, terminal };
}

function ComponentNode({
  component,
  compact,
  styles,
  isLast,
  chevronColor,
}: {
  component: SpeciesRig['components'][number];
  compact?: boolean;
  styles: ReturnType<typeof createStyles>;
  isLast: boolean;
  chevronColor: string;
}) {
  return (
    <View style={styles.componentNode}>
      <RigComponentIcon role={component.role} size={compact ? 14 : 16} />
      <Text style={styles.componentLabel} numberOfLines={2}>
        {component.label}
      </Text>
      {component.detail ? (
        <Text style={styles.componentDetail} numberOfLines={1}>
          {component.detail}
        </Text>
      ) : null}
      {!isLast ? <ChevronRight size={12} color={chevronColor} style={styles.arrow} /> : null}
    </View>
  );
}

export default function RigDiagramCard({ rig, compact = false }: RigDiagramCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { mainline, terminal } = partitionComponents(rig.components);
  const steps = compact ? rig.steps?.slice(0, 2) : rig.steps;
  const componentSummary = rig.components.map((c) => c.label).join(', ');
  const a11yLabel = `${rig.isPrimary ? 'Primary rig: ' : ''}${rig.name}. Components: ${componentSummary}. ${getRigTypeLabel(rig.rigType)} rig.`;

  return (
    <View
      style={[
        styles.card,
        rig.isPrimary ? styles.cardPrimary : styles.cardAlternate,
        compact && styles.cardCompact,
      ]}
      accessibilityRole="summary"
      accessibilityLabel={a11yLabel}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {rig.isPrimary ? <Star color={colors.accent} size={14} fill={colors.accent} /> : null}
          <Text style={[styles.rigName, compact && styles.rigNameCompact]} numberOfLines={2}>
            {rig.name}
          </Text>
        </View>
        <View style={styles.rigTypeBadge}>
          <Text style={styles.rigTypeText}>{getRigTypeLabel(rig.rigType)}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.stripScroll}
        contentContainerStyle={styles.stripContent}
      >
        {mainline.map((component, index) => (
          <ComponentNode
            key={`${component.role}-${index}`}
            component={component}
            compact={compact}
            styles={styles}
            isLast={index === mainline.length - 1}
            chevronColor={colors.textMuted}
          />
        ))}
      </ScrollView>

      {terminal.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.stripScroll}
          contentContainerStyle={styles.stripContent}
        >
          {terminal.map((component, index) => (
            <ComponentNode
              key={`${component.role}-t-${index}`}
              component={component}
              compact={compact}
              styles={styles}
              isLast={index === terminal.length - 1}
              chevronColor={colors.textMuted}
            />
          ))}
        </ScrollView>
      ) : null}

      {(rig.retrieve || rig.targetDepth) ? (
        <View style={styles.metaRow}>
          {rig.retrieve ? (
            <Text style={styles.metaText}>
              <Text style={styles.metaLabel}>Retrieve: </Text>
              {rig.retrieve}
            </Text>
          ) : null}
          {rig.targetDepth ? (
            <Text style={styles.depthBadge}>
              Depth: {rig.targetDepth}
            </Text>
          ) : null}
        </View>
      ) : null}

      {steps && steps.length > 0 ? (
        <View style={styles.stepsSection}>
          {steps.map((step, index) => (
            <View key={index} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {rig.tip && !compact ? (
        <Text style={styles.tipText}>
          <Text style={styles.metaLabel}>Tip: </Text>
          {rig.tip}
        </Text>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginTop: Spacing.sm,
    },
    cardPrimary: {
      borderWidth: 1,
      borderColor: colors.accent,
    },
    cardAlternate: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardLight,
    },
    cardCompact: {
      padding: Spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    titleRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    rigName: {
      flex: 1,
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
    },
    rigNameCompact: {
      fontSize: FontSizes.sm,
    },
    rigTypeBadge: {
      backgroundColor: colors.accentDark,
      borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
    },
    rigTypeText: {
      color: colors.textSecondary,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.bold,
      letterSpacing: 0.5,
    },
    stripScroll: {
      marginBottom: Spacing.xs,
    },
    stripContent: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: Spacing.xs,
      gap: Spacing.xs,
    },
    componentNode: {
      flexDirection: 'row',
      alignItems: 'center',
      maxWidth: 160,
      gap: 4,
    },
    componentLabel: {
      flexShrink: 1,
      color: colors.text,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.medium,
      maxWidth: 90,
    },
    componentDetail: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      maxWidth: 70,
    },
    arrow: {
      marginHorizontal: 2,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    metaText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      minWidth: '60%',
    },
    metaLabel: {
      fontWeight: FontWeights.semibold,
      color: colors.text,
    },
    depthBadge: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      backgroundColor: colors.cardLight,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: BorderRadius.sm,
      overflow: 'hidden',
    },
    stepsSection: {
      marginTop: Spacing.sm,
      gap: Spacing.xs,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    stepNumber: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.accentDark,
      color: colors.text,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.bold,
      textAlign: 'center',
      lineHeight: 18,
      overflow: 'hidden',
    },
    stepText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
    },
    tipText: {
      marginTop: Spacing.sm,
      color: colors.textMuted,
      fontSize: FontSizes.sm,
      fontStyle: 'italic',
    },
  });
}
