import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Crown, Sparkles } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { PRO_FEATURE_BULLETS } from '@/constants/pro';
import { usePro } from '@/providers/ProProvider';
import { useSubscriptionGate } from '@/providers/SubscriptionGateProvider';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui';
import BrandMark from '@/components/brand/BrandMark';
import { hapticLight } from '@/utils/haptics';

const GATE_FEATURE_BULLETS = PRO_FEATURE_BULLETS.slice(0, 5);

export default function ProSubscriptionGate() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { markComplete } = useSubscriptionGate();
  const { isPro, loading, monthlyPriceLabel, purchaseProMonthly, restorePurchases } = usePro();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && isPro) {
      markComplete();
    }
  }, [isPro, loading, markComplete]);

  const handleContinueFree = () => {
    hapticLight();
    markComplete();
  };

  const handleSubscribe = async () => {
    hapticLight();
    setError(null);
    setPurchasing(true);
    const { error: purchaseError, entitled } = await purchaseProMonthly();
    setPurchasing(false);
    if (purchaseError) {
      setError(purchaseError);
      return;
    }
    if (entitled) {
      markComplete();
    }
  };

  const handleRestore = async () => {
    hapticLight();
    setError(null);
    setRestoring(true);
    const { entitled, error: restoreError } = await restorePurchases();
    setRestoring(false);
    if (restoreError) {
      setError(restoreError);
      return;
    }
    if (!entitled) {
      setError('No previous Pro purchase found for this store account.');
      return;
    }
    markComplete();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <BrandMark size="md" showTagline />
        </View>

        <View style={styles.hero}>
          <View style={styles.iconBadge}>
            <Sparkles color={colors.accent} size={28} />
          </View>
          <Text style={styles.headline}>Unlock CatchMap Pro</Text>
          <Text style={styles.subtitle}>
            Fish smarter with hosted AI, cloud backup, offline maps, and more.
          </Text>
          <Text style={styles.price}>{loading ? '…' : monthlyPriceLabel}</Text>
          <Text style={styles.priceNote}>Monthly subscription · cancel anytime</Text>
        </View>

        <View style={styles.featureList}>
          {GATE_FEATURE_BULLETS.map((item) => (
            <View key={item} style={styles.featureRow}>
              <Check color={colors.success} size={18} />
              <Text style={styles.featureText}>{item}</Text>
            </View>
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          title={purchasing ? 'Processing…' : `Start Pro — ${monthlyPriceLabel}`}
          onPress={handleSubscribe}
          loading={purchasing}
          style={styles.primaryButton}
          accessibilityLabel={`Subscribe to Pro for ${monthlyPriceLabel}`}
        />

        <TouchableOpacity
          onPress={handleContinueFree}
          style={styles.freeButton}
          accessibilityRole="button"
          accessibilityLabel="Continue with free plan"
        >
          <Text style={styles.freeButtonText}>Continue with Free</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleRestore}
          disabled={restoring}
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
        >
          {restoring ? (
            <ActivityIndicator color={colors.accent} style={styles.restoreSpinner} />
          ) : (
            <Text style={styles.restoreText}>Restore purchases</Text>
          )}
        </TouchableOpacity>

        <View style={styles.freeNote}>
          <Crown color={colors.textMuted} size={16} />
          <Text style={styles.freeNoteText}>
            Free includes map discovery, catch logging, bite forecasts, and species guide.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xxl,
    },
    header: {
      alignItems: 'center',
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    hero: {
      alignItems: 'center',
      paddingVertical: Spacing.lg,
    },
    iconBadge: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accentDark,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    headline: {
      color: colors.text,
      fontSize: FontSizes.xxxl,
      fontWeight: FontWeights.bold,
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.md,
      textAlign: 'center',
      marginTop: Spacing.xs,
      lineHeight: 22,
    },
    price: {
      color: colors.text,
      fontSize: 40,
      fontWeight: FontWeights.bold,
      marginTop: Spacing.lg,
    },
    priceNote: {
      color: colors.textMuted,
      fontSize: FontSizes.sm,
      marginTop: Spacing.xs,
    },
    featureList: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      gap: Spacing.md,
      marginBottom: Spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
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
    errorText: {
      color: colors.error,
      fontSize: FontSizes.sm,
      marginBottom: Spacing.md,
      textAlign: 'center',
    },
    primaryButton: {
      marginBottom: Spacing.sm,
    },
    freeButton: {
      alignItems: 'center',
      paddingVertical: Spacing.md,
      marginBottom: Spacing.xs,
    },
    freeButtonText: {
      color: colors.textSecondary,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
    },
    restoreText: {
      color: colors.accent,
      fontSize: FontSizes.sm,
      textAlign: 'center',
      fontWeight: FontWeights.medium,
      paddingVertical: Spacing.sm,
    },
    restoreSpinner: {
      marginVertical: Spacing.sm,
    },
    freeNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      marginTop: Spacing.lg,
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
    },
    freeNoteText: {
      flex: 1,
      color: colors.textMuted,
      fontSize: FontSizes.sm,
      lineHeight: 20,
    },
  });
}
