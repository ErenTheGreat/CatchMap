import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Crown } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { usePro } from '@/providers/ProProvider';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui';
import { PRO_UPGRADE_HREF } from '@/constants/routes';

interface ProUpsellCardProps {
  title: string;
  description: string;
  compact?: boolean;
}

export default function ProUpsellCard({ title, description, compact = false }: ProUpsellCardProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { isPro, priceLabel } = usePro();

  if (isPro) {
    return null;
  }

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.header}>
        <Crown color={colors.accent} size={20} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.description}>{description}</Text>
      <Button
        title={`Upgrade to Pro — ${priceLabel}`}
        onPress={() => router.push(PRO_UPGRADE_HREF)}
        style={styles.button}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: Spacing.md,
    },
    cardCompact: {
      padding: Spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    title: {
      color: colors.text,
      fontSize: FontSizes.lg,
      fontWeight: FontWeights.semibold,
      flex: 1,
    },
    description: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      lineHeight: 20,
      marginBottom: Spacing.md,
    },
    button: {},
  });
}
