import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check, Crown, Sparkles, X } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { PRO_FEATURE_BULLETS, PRO_LAUNCH_PROMO_ACTIVE } from '@/constants/pro';
import { usePro } from '@/providers/ProProvider';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui';

interface ProPaywallProps {
  /** When embedded, omit the close button and safe-area header chrome. */
  embedded?: boolean;
  headline?: string;
  subtitle?: string;
  onClose?: () => void;
}

export default function ProPaywall({
  embedded = false,
  headline = 'CatchMap Pro',
  subtitle = 'Subscribe monthly or unlock lifetime — fish smarter with hosted AI, cloud backup, and more.',
  onClose,
}: ProPaywallProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const {
    isPro,
    loading,
    priceLabel,
    monthlyPriceLabel,
    purchasePro,
    purchaseProMonthly,
    restorePurchases,
  } = usePro();
  const [purchasingMonthly, setPurchasingMonthly] = useState(false);
  const [purchasingLifetime, setPurchasingLifetime] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    }
  };

  const handleSubscribeMonthly = async () => {
    setError(null);
    setPurchasingMonthly(true);
    const { error: purchaseError, entitled } = await purchaseProMonthly();
    setPurchasingMonthly(false);
    if (purchaseError) {
      setError(purchaseError);
      return;
    }
    if (entitled) {
      handleClose();
    }
  };

  const handlePurchaseLifetime = async () => {
    setError(null);
    setPurchasingLifetime(true);
    const { error: purchaseError, entitled } = await purchasePro();
    setPurchasingLifetime(false);
    if (purchaseError) {
      setError(purchaseError);
      return;
    }
    if (entitled) {
      handleClose();
    }
  };

  const handleRestore = async () => {
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
    handleClose();
  };

  if (isPro && !embedded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.proActiveCard}>
          <Crown color={colors.accent} size={32} />
          <Text style={styles.proActiveTitle}>You have CatchMap Pro</Text>
          <Text style={styles.proActiveSubtitle}>All Pro features are unlocked on this device.</Text>
          <Button title="Done" onPress={handleClose} style={styles.primaryButton} />
        </View>
      </SafeAreaView>
    );
  }

  const content = (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.iconBadge}>
          <Sparkles color={colors.accent} size={28} />
        </View>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.recommendedPill}>
          <Text style={styles.recommendedText}>Recommended</Text>
        </View>
        <Text style={styles.price}>{loading ? '…' : monthlyPriceLabel}</Text>
        <Text style={styles.priceNote}>Monthly subscription · cancel anytime</Text>
      </View>

      <View style={styles.featureList}>
        {PRO_FEATURE_BULLETS.map((item) => (
          <View key={item} style={styles.featureRow}>
            <Check color={colors.success} size={18} />
            <Text style={styles.featureText}>{item}</Text>
          </View>
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Button
        title={purchasingMonthly ? 'Processing…' : `Subscribe — ${monthlyPriceLabel}`}
        onPress={handleSubscribeMonthly}
        loading={purchasingMonthly}
        style={styles.primaryButton}
        accessibilityLabel={`Subscribe to Pro for ${monthlyPriceLabel}`}
      />

      <Text style={styles.renewalNote}>
        Subscription auto-renews monthly. Cancel anytime in your store account settings.
      </Text>

      <View style={styles.lifetimeCard}>
        {PRO_LAUNCH_PROMO_ACTIVE ? (
          <Text style={styles.lifetimePromo}>Launch price on lifetime — limited time</Text>
        ) : null}
        <Text style={styles.lifetimeTitle}>Prefer to pay once?</Text>
        <Text style={styles.lifetimePrice}>{loading ? '…' : priceLabel} · lifetime access</Text>
        <TouchableOpacity
          onPress={handlePurchaseLifetime}
          disabled={purchasingLifetime || purchasingMonthly}
          style={styles.lifetimeButton}
          accessibilityRole="button"
          accessibilityLabel={`Unlock lifetime Pro for ${priceLabel}`}
        >
          {purchasingLifetime ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={styles.lifetimeButtonText}>Unlock lifetime — {loading ? '…' : priceLabel}</Text>
          )}
        </TouchableOpacity>
      </View>

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
    </ScrollView>
  );

  if (embedded) {
    return <View style={styles.embedded}>{content}</View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={handleClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X color={colors.textMuted} size={24} />
        </TouchableOpacity>
      </View>
      {content}
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    embedded: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topBar: {
      alignItems: 'flex-end',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
    },
    scroll: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xxl,
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
    recommendedPill: {
      marginTop: Spacing.md,
      backgroundColor: colors.accentDark,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.full,
    },
    recommendedText: {
      color: colors.accent,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
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
      marginBottom: Spacing.xs,
    },
    renewalNote: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: Spacing.lg,
      paddingHorizontal: Spacing.sm,
    },
    lifetimeCard: {
      backgroundColor: colors.cardLight,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
    },
    lifetimePromo: {
      color: colors.accent,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.semibold,
      marginBottom: Spacing.xs,
    },
    lifetimeTitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      marginBottom: Spacing.xs,
    },
    lifetimePrice: {
      color: colors.textMuted,
      fontSize: FontSizes.sm,
      marginBottom: Spacing.md,
    },
    lifetimeButton: {
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    lifetimeButtonText: {
      color: colors.accent,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
      textAlign: 'center',
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
    proActiveCard: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    proActiveTitle: {
      color: colors.text,
      fontSize: FontSizes.xxl,
      fontWeight: FontWeights.bold,
    },
    proActiveSubtitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.md,
      textAlign: 'center',
    },
  });
}
