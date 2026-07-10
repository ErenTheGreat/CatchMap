import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Crown, Check } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import {
  PRO_ONBOARDING_BULLETS,
  PRO_SUBSCRIPTION_DISCLOSURE,
} from '@/constants/pro';
import { usePro } from '@/providers/ProProvider';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui';

interface ProOnboardingSlideProps {
  onContinueFree: () => void;
  onSubscribed?: () => void;
}

export default function ProOnboardingSlide({
  onContinueFree,
  onSubscribed,
}: ProOnboardingSlideProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { isPro, loading, priceLabel, purchasesAvailable, purchasePro } = usePro();
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setError(null);
    setPurchasing(true);
    const { error: purchaseError, entitled } = await purchasePro();
    setPurchasing(false);
    if (purchaseError) {
      setError(purchaseError);
      return;
    }
    if (entitled) {
      onSubscribed?.();
      onContinueFree();
    }
  };

  if (isPro) {
    return (
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Crown color={colors.accent} size={64} />
        </View>
        <Text style={styles.title}>CatchMap Pro is active</Text>
        <Text style={styles.description}>
          All Pro features are unlocked. Continue to set up your map.
        </Text>
        <Button title="Continue" onPress={onContinueFree} style={styles.primaryButton} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Crown color={colors.accent} size={64} />
      </View>
      <Text style={styles.title}>Unlock CatchMap Pro</Text>
      <Text style={styles.description}>
        Go beyond the free map and log with AI, cloud backup, offline maps, and trip planning.
      </Text>

      <View style={styles.featureList}>
        {PRO_ONBOARDING_BULLETS.map((item) => (
          <View key={item} style={styles.featureRow}>
            <Check color={colors.success} size={16} />
            <Text style={styles.featureText}>{item}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.price}>{loading ? '…' : priceLabel}</Text>
      <Text style={styles.priceNote}>{PRO_SUBSCRIPTION_DISCLOSURE}</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {purchasesAvailable ? (
        <Button
          title={purchasing ? 'Processing…' : `Start Pro — ${priceLabel}`}
          onPress={handleSubscribe}
          loading={purchasing}
          style={styles.primaryButton}
        />
      ) : null}

      <Button
        title="Continue with Free"
        onPress={onContinueFree}
        variant="secondary"
        style={styles.secondaryButton}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
    },
    iconCircle: {
      width: 128,
      height: 128,
      borderRadius: 64,
      backgroundColor: colors.cardLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    title: {
      color: colors.text,
      fontSize: FontSizes.xxl,
      fontWeight: FontWeights.bold,
      textAlign: 'center',
      marginBottom: Spacing.sm,
    },
    description: {
      color: colors.textSecondary,
      fontSize: FontSizes.md,
      lineHeight: 24,
      textAlign: 'center',
      marginBottom: Spacing.lg,
    },
    featureList: {
      alignSelf: 'stretch',
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    featureText: {
      flex: 1,
      color: colors.text,
      fontSize: FontSizes.sm,
      lineHeight: 20,
    },
    price: {
      color: colors.text,
      fontSize: FontSizes.xxxl,
      fontWeight: FontWeights.bold,
      marginBottom: Spacing.xs,
    },
    priceNote: {
      color: colors.textMuted,
      fontSize: FontSizes.sm,
      textAlign: 'center',
      marginBottom: Spacing.lg,
    },
    errorText: {
      color: colors.error,
      fontSize: FontSizes.sm,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    primaryButton: {
      alignSelf: 'stretch',
      marginBottom: Spacing.sm,
    },
    secondaryButton: {
      alignSelf: 'stretch',
    },
  });
}
