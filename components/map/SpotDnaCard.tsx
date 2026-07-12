import React from 'react';
import { View, StyleSheet } from 'react-native';
import AccessibleText from '@/components/ui/AccessibleText';
import { Dna, Fish, Users, Scale } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import type { SpotDnaProfile } from '@/lib/types/spotDna';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';

interface SpotDnaCardProps {
  profile: SpotDnaProfile;
}

export default function SpotDnaCard({ profile }: SpotDnaCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const hasContent =
    profile.hasPersonalHistory || profile.community != null || profile.regulationCount > 0;

  if (!hasContent) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Dna color={colors.accent} size={16} />
          <AccessibleText style={styles.title}>Spot DNA</AccessibleText>
        </View>
        <AccessibleText style={styles.headline}>{profile.headline}</AccessibleText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Dna color={colors.accent} size={16} />
        <AccessibleText style={styles.title}>Spot DNA</AccessibleText>
      </View>
      <AccessibleText style={styles.headline}>{profile.headline}</AccessibleText>

      {profile.personal?.bestMonth ? (
        <View style={styles.row}>
          <Fish color={colors.success} size={14} />
          <AccessibleText style={styles.rowText}>
            Your best month: {profile.personal.bestMonth.label} ({profile.personal.bestMonth.count}{' '}
            catches)
          </AccessibleText>
        </View>
      ) : null}

      {profile.personal?.goToRig ? (
        <View style={styles.row}>
          <Fish color={colors.accent} size={14} />
          <AccessibleText style={styles.rowText}>
            Your go-to rig: {profile.personal.goToRig.lure} ({profile.personal.goToRig.count}/
            {profile.personal.goToRig.total} catches)
          </AccessibleText>
        </View>
      ) : null}

      {profile.community?.topSpecies ? (
        <View style={styles.row}>
          <Users color={colors.warning} size={14} />
          <AccessibleText style={styles.rowText}>
            Community: {profile.community.topSpecies.name} active ({profile.community.topSpecies.count}{' '}
            catches, {profile.community.daysBack}d)
          </AccessibleText>
        </View>
      ) : null}

      {profile.community?.topLures && profile.community.topLures.length > 0 ? (
        <View style={styles.row}>
          <Users color={colors.textMuted} size={14} />
          <AccessibleText style={styles.rowText}>
            Top community lures: {profile.community.topLures.join(', ')}
          </AccessibleText>
        </View>
      ) : null}

      {profile.regulationCount > 0 ? (
        <View style={styles.row}>
          <Scale color={colors.textMuted} size={14} />
          <AccessibleText style={styles.rowText}>
            {profile.regulationCount} regulation {profile.regulationCount === 1 ? 'notice' : 'notices'}{' '}
            apply here
          </AccessibleText>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      gap: Spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: 2,
    },
    title: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      color: colors.text,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    headline: {
      fontSize: FontSizes.sm,
      color: colors.text,
      lineHeight: 20,
      marginBottom: Spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      paddingVertical: 2,
    },
    rowText: {
      flex: 1,
      fontSize: FontSizes.sm,
      color: colors.textMuted,
      lineHeight: 18,
    },
  });
}
