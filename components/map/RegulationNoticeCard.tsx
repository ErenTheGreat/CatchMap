import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Linking from 'expo-linking';
import { AlertTriangle, ChevronDown, ChevronUp, Shield, ShieldAlert } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import type { RegulationNotice, RegulationSeverity } from '@/lib/types/fishingRegulations';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/components/ui';

interface RegulationNoticeCardProps {
  notices: RegulationNotice[];
}

const MAX_VISIBLE = 2;

function getSeverityStyles(colors: ThemeColors, severity: RegulationSeverity) {
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

function NoticeRow({
  notice,
  styles,
  colors,
  onLinkError,
}: {
  notice: RegulationNotice;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  onLinkError?: () => void;
}) {
  const { borderColor, backgroundColor, iconColor, Icon } = getSeverityStyles(colors, notice.severity);

  return (
    <View style={[styles.noticeRow, { borderColor, backgroundColor }]}>
      <View style={styles.noticeIcon}>
        <Icon color={iconColor} size={16} />
      </View>
      <View style={styles.noticeContent}>
        <Text style={styles.noticeTitle}>{notice.title}</Text>
        <Text style={styles.noticeMessage}>{notice.message}</Text>
        {notice.regulationsUrl ? (
          <Pressable onPress={() => openRegulationsUrl(notice.regulationsUrl!, onLinkError)}>
            <Text style={styles.noticeLink}>View official regulations</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function RegulationNoticeCard({ notices }: RegulationNoticeCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const handleLinkError = () => {
    showToast({ message: 'Could not open regulations link', variant: 'error' });
  };

  if (notices.length === 0) return null;

  const visibleNotices = expanded ? notices : notices.slice(0, MAX_VISIBLE);
  const hiddenCount = notices.length - MAX_VISIBLE;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Regulations</Text>
      <View style={styles.noticeList}>
        {visibleNotices.map((notice) => (
          <NoticeRow
            key={notice.id}
            notice={notice}
            styles={styles}
            colors={colors}
            onLinkError={handleLinkError}
          />
        ))}
      </View>
      {hiddenCount > 0 ? (
        <Pressable style={styles.expandButton} onPress={() => setExpanded((v) => !v)}>
          {expanded ? (
            <ChevronUp color={colors.textMuted} size={14} />
          ) : (
            <ChevronDown color={colors.textMuted} size={14} />
          )}
          <Text style={styles.expandText}>
            {expanded ? 'Show fewer' : `+${hiddenCount} more notice${hiddenCount === 1 ? '' : 's'}`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
      marginBottom: Spacing.xs,
    },
    noticeList: {
      gap: Spacing.xs,
    },
    noticeRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      padding: Spacing.sm,
      borderRadius: BorderRadius.sm,
      borderWidth: 1,
    },
    noticeIcon: {
      marginTop: 2,
    },
    noticeContent: {
      flex: 1,
      minWidth: 0,
    },
    noticeTitle: {
      color: colors.text,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      marginBottom: 2,
    },
    noticeMessage: {
      color: colors.textSecondary,
      fontSize: FontSizes.xs,
      lineHeight: 18,
    },
    noticeLink: {
      color: colors.accent,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.medium,
      marginTop: Spacing.xs,
      textDecorationLine: 'underline',
    },
    expandButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: Spacing.xs,
      paddingVertical: 4,
    },
    expandText: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
    },
  });
}
