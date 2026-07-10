import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check, Crown, Sparkles, X } from 'lucide-react-native';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { PRO_FEATURE_BULLETS, PRO_SUBSCRIPTION_DISCLOSURE } from '@/constants/pro';
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
  subtitle = 'Fish smarter with AI, cloud sync, and offline maps.',
  onClose,
}: ProPaywallProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { isPro, loading, priceLabel, purchasesAvailable, purchasePro, restorePurchases } = usePro();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const privacyPolicyUrl = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
  const termsOfServiceUrl = process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL;

  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    }
  };

  const handlePurchase = async () => {
    setError(null);
    setPurchasing(true);
    const { error: purchaseError, entitled } = await purchasePro();
    setPurchasing(false);
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

  const openLegalUrl = async (url: string | undefined) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      setError('Could not open link.');
    }
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
        <Text style={styles.price}>{loading ? '…' : priceLabel}</Text>
        <Text style={styles.priceNote}>{PRO_SUBSCRIPTION_DISCLOSURE}</Text>
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

      {purchasesAvailable ? (
        <>
          <Button
            title={purchasing ? 'Processing…' : `Start Pro — ${priceLabel}`}
            onPress={handlePurchase}
            loading={purchasing}
            style={styles.primaryButton}
          />
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
        </>
      ) : null}

      {(privacyPolicyUrl || termsOfServiceUrl) ? (
        <View style={styles.legalLinks}>
          {termsOfServiceUrl ? (
            <TouchableOpacity
              onPress={() => openLegalUrl(termsOfServiceUrl)}
              accessibilityRole="link"
              accessibilityLabel="Terms of Service"
            >
              <Text style={styles.legalLinkText}>Terms of Service</Text>
            </TouchableOpacity>
          ) : null}
          {privacyPolicyUrl && termsOfServiceUrl ? (
            <Text style={styles.legalSeparator}> · </Text>
          ) : null}
          {privacyPolicyUrl ? (
            <TouchableOpacity
              onPress={() => openLegalUrl(privacyPolicyUrl)}
              accessibilityRole="link"
              accessibilityLabel="Privacy Policy"
            >
              <Text style={styles.legalLinkText}>Privacy Policy</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
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
      textAlign: 'center',
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
      marginBottom: Spacing.md,
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
    legalLinks: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: Spacing.lg,
    },
    legalLinkText: {
      color: colors.textMuted,
      fontSize: FontSizes.sm,
      textDecorationLine: 'underline',
    },
    legalSeparator: {
      color: colors.textMuted,
      fontSize: FontSizes.sm,
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
