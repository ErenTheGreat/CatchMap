import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Linking from 'expo-linking';
import { AlertTriangle, ChevronRight, Shield, ShieldAlert } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import type { RegulationNotice, RegulationSeverity } from '@/lib/types/fishingRegulations';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/components/ui';

interface AreaRegulationsBannerProps {
  notices: RegulationNotice[];
}

function getSeverityMeta(colors: ThemeColors, severity: RegulationSeverity) {
  switch (severity) {
    case 'closed':
      return {
        borderColor: colors.error,
        backgroundColor: colors.errorSurface,
        iconColor: colors.error,
        Icon: ShieldAlert,
      };
    case 'warning':
      return {
        borderColor: colors.warning,
        backgroundColor: colors.warningSurface,
        iconColor: colors.warning,
        Icon: AlertTriangle,
      };
    default:
      return {
        borderColor: colors.border,
        backgroundColor: colors.cardLight,
        iconColor: colors.textSecondary,
        Icon: Shield,
      };
  }
}

function openRegulationsUrl(url: string, onError?: () => void) {
  Linking.openURL(url).catch(() => {
    onError?.();
  });
}

export default function AreaRegulationsBanner({ notices }: AreaRegulationsBannerProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();

  if (notices.length === 0) return null;

  const primary = notices[0];
  const { borderColor, backgroundColor, iconColor, Icon } = getSeverityMeta(colors, primary.severity);
  const extraCount = notices.length - 1;

  return (
    <Pressable
      style={[styles.banner, { borderColor, backgroundColor }]}
      onPress={() =>
        primary.regulationsUrl &&
        openRegulationsUrl(primary.regulationsUrl, () =>
          showToast({ message: 'Could not open regulations link', variant: 'error' })
        )
      }
      disabled={!primary.regulationsUrl}
      accessibilityRole="button"
      accessibilityLabel={`${primary.title}. ${primary.message}`}
    >
      <Icon color={iconColor} size={16} />
      <View style={styles.content}>
        <Text style={styles.title}>{primary.title}</Text>
        <Text style={styles.message} numberOfLines={2}>
          {primary.message}
        </Text>
        {extraCount > 0 ? (
          <Text style={styles.extra}>+{extraCount} more rule{extraCount === 1 ? '' : 's'} at this spot</Text>
        ) : null}
      </View>
      {primary.regulationsUrl ? <ChevronRight color={colors.textMuted} size={16} /> : null}
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
      padding: Spacing.sm,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
    },
    content: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      color: colors.text,
    },
    message: {
      fontSize: FontSizes.xs,
      color: colors.textSecondary,
      lineHeight: 16,
      marginTop: 2,
    },
    extra: {
      fontSize: FontSizes.xs,
      color: colors.textMuted,
      marginTop: 4,
    },
  });
}
