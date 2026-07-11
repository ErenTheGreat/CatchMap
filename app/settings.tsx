import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import {
  ChevronLeft,
  Thermometer,
  Scale,
  Palette,
  Download,
  Trash2,
  Info,
  Shield,
  MessageSquare,
  UserRound,
  LogIn,
  LogOut,
  FileText,
  UserX,
  Sparkles,
  Crown,
} from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { isCloudSyncFeatureAvailable, isCloudSyncEnabled } from '@/constants/features';
import { Button, useToast, SegmentedControl } from '@/components/ui';
import { PRO_LAUNCH_PROMO_ACTIVE } from '@/constants/pro';
import { PRO_UPGRADE_HREF } from '@/constants/routes';
import { usePro } from '@/providers/ProProvider';
import { Spacing, FontSizes, BorderRadius, FontWeights, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useAuth } from '@/providers/AuthProvider';
import { useTheme, type ThemePreference } from '@/providers/ThemeProvider';
import { useUnits, type TemperatureUnit, type WeightUnit } from '@/providers/UnitsProvider';
import { useCatches } from '@/hooks/useCatches';
import { fishingApi } from '@/lib/api/fishingApi';
import { clearAllWaypoints } from '@/utils/waypointsStorage';
import BrandMark from '@/components/brand/BrandMark';
import { hapticSuccess, hapticError } from '@/utils/haptics';
import type { CatchRecord } from '@/lib/api/fishingApi';
import { buildSeasonRecapText } from '@/utils/seasonRecap';

function toCsv(catches: CatchRecord[]): string {
  const header = [
    'species',
    'weight',
    'length',
    'lure',
    'notes',
    'date',
    'latitude',
    'longitude',
    'locationName',
  ];
  const escape = (value: unknown) => {
    const str = value == null ? '' : String(value);
    return `"${str.replace(/"/g, '""')}"`;
  };
  const rows = catches.map((c) =>
    [
      c.species,
      c.weight,
      c.length ?? '',
      c.lure,
      c.notes,
      c.date,
      c.latitude ?? '',
      c.longitude ?? '',
      c.locationName ?? '',
    ]
      .map(escape)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

export default function SettingsScreen() {
  const { colors, preference, setPreference } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const {
    temperatureUnit,
    weightUnit,
    setTemperatureUnit,
    setWeightUnit,
  } = useUnits();
  const { data: catches = [] } = useCatches();

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const privacyPolicyUrl = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
  const termsOfServiceUrl = process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL;
  const { user, signOut, deleteAccount } = useAuth();
  const cloudSyncAvailable = isCloudSyncFeatureAvailable();
  const cloudSync = isCloudSyncEnabled();
  const { isPro, priceLabel, purchasePro, restorePurchases } = usePro();
  const [purchasingPro, setPurchasingPro] = useState(false);
  const [restoringPro, setRestoringPro] = useState(false);

  const handlePurchasePro = async () => {
    setPurchasingPro(true);
    const { error, entitled } = await purchasePro();
    setPurchasingPro(false);
    if (error) {
      showToast({ message: error, variant: 'error' });
      return;
    }
    if (entitled) {
      hapticSuccess();
      showToast({ message: 'CatchMap Pro unlocked', variant: 'success' });
    }
  };

  const handleRestorePro = async () => {
    setRestoringPro(true);
    const { entitled, error } = await restorePurchases();
    setRestoringPro(false);
    if (error) {
      showToast({ message: error, variant: 'error' });
      return;
    }
    if (entitled) {
      hapticSuccess();
      showToast({ message: 'Pro restored', variant: 'success' });
    } else {
      showToast({ message: 'No Pro purchase found for this account', variant: 'warning' });
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign out',
      'Catches already backed up stay in your account. New catches will be saved on this device only until you sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              await queryClient.invalidateQueries({ queryKey: ['catches'] });
              hapticSuccess();
              showToast({ message: 'Signed out', variant: 'success' });
            } catch {
              hapticError();
              showToast({ message: 'Could not sign out', variant: 'error' });
            }
          },
        },
      ]
    );
  };

  const handleExport = () => {
    if (catches.length === 0) {
      showToast({ message: 'No catches to export yet', variant: 'warning' });
      return;
    }
    Alert.alert('Export catches', `Export your ${catches.length} catches as:`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'JSON',
        onPress: () =>
          shareContent(JSON.stringify(catches, null, 2), 'fishing-catches.json'),
      },
      {
        text: 'CSV',
        onPress: () => shareContent(toCsv(catches), 'fishing-catches.csv'),
      },
      ...(isPro
        ? [
            {
              text: 'Season recap',
              onPress: () => {
                const recap = buildSeasonRecapText(catches);
                if (!recap) {
                  showToast({ message: 'Could not build season recap', variant: 'warning' });
                  return;
                }
                void shareContent(recap, 'catchmap-season-recap.txt');
              },
            },
          ]
        : []),
    ]);
  };

  const shareContent = async (content: string, title: string) => {
    try {
      await Share.share({ message: content, title });
    } catch {
      showToast({ message: 'Could not open share sheet', variant: 'error' });
    }
  };

  const handleClearLocal = () => {
    Alert.alert(
      cloudSync ? 'Clear locally saved catches' : 'Clear all catches',
      cloudSync
        ? 'This removes catches saved only on this device (not yet synced to the cloud). Synced catches are not affected. Continue?'
        : 'This permanently removes all catches stored on this device. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await fishingApi.clearLocalCatches();
              await queryClient.invalidateQueries({ queryKey: ['catches'] });
              hapticSuccess();
              showToast({
                message: cloudSync ? 'Local catches cleared' : 'All catches cleared',
                variant: 'success',
              });
            } catch {
              hapticError();
              showToast({ message: 'Could not clear catches', variant: 'error' });
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your CatchMap account, cloud catches, photos, and waypoints. Catches saved only on this device are not removed. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteAccount();
              if (result.error) {
                hapticError();
                showToast({ message: result.error, variant: 'error' });
                return;
              }
              await fishingApi.clearLocalCatches();
              await clearAllWaypoints();
              await queryClient.invalidateQueries({ queryKey: ['catches'] });
              await queryClient.invalidateQueries({ queryKey: ['waypoints'] });
              hapticSuccess();
              showToast({ message: 'Account deleted', variant: 'success' });
              router.back();
            } catch {
              hapticError();
              showToast({ message: 'Could not delete account', variant: 'error' });
            }
          },
        },
      ]
    );
  };

  const handleOpenPrivacyPolicy = async () => {
    if (!privacyPolicyUrl) return;
    try {
      await WebBrowser.openBrowserAsync(privacyPolicyUrl);
    } catch {
      showToast({ message: 'Could not open privacy policy', variant: 'error' });
    }
  };

  const handleOpenTermsOfService = async () => {
    if (!termsOfServiceUrl) return;
    try {
      await WebBrowser.openBrowserAsync(termsOfServiceUrl);
    } catch {
      showToast({ message: 'Could not open terms of service', variant: 'error' });
    }
  };

  const themeOptions: { id: ThemePreference; label: string }[] = [
    { id: 'system', label: 'System' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'outdoor', label: 'Outdoor' },
  ];
  const tempOptions: { id: TemperatureUnit; label: string }[] = [
    { id: 'F', label: '°F' },
    { id: 'C', label: '°C' },
  ];
  const weightOptions: { id: WeightUnit; label: string }[] = [
    { id: 'lb', label: 'lb' },
    { id: 'kg', label: 'kg' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.brandRow}>
        <BrandMark size="sm" />
      </View>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft color={colors.text} size={26} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.card}>
          <View style={styles.rowHeader}>
            <Palette color={colors.accent} size={18} />
            <Text style={styles.rowTitle}>Theme</Text>
          </View>
          <SegmentedControl
            options={themeOptions}
            value={preference}
            onChange={setPreference}
            accessibilityLabel="Theme preference"
          />
        </View>

        <Text style={styles.sectionLabel}>Units</Text>
        <View style={styles.card}>
          <View style={styles.rowHeader}>
            <Thermometer color={colors.accent} size={18} />
            <Text style={styles.rowTitle}>Temperature</Text>
          </View>
          <SegmentedControl
            options={tempOptions}
            value={temperatureUnit}
            onChange={setTemperatureUnit}
            accessibilityLabel="Temperature unit"
          />
          <View style={[styles.rowHeader, styles.rowSpacer]}>
            <Scale color={colors.accent} size={18} />
            <Text style={styles.rowTitle}>Weight</Text>
          </View>
          <SegmentedControl
            options={weightOptions}
            value={weightUnit}
            onChange={setWeightUnit}
            accessibilityLabel="Weight unit"
          />
        </View>

        <Text style={styles.sectionLabel}>CatchMap Pro</Text>
        <View style={styles.card}>
          <View style={styles.rowHeader}>
            <Crown color={colors.accent} size={18} />
            <Text style={styles.rowTitle}>{isPro ? 'Pro active' : 'Upgrade to Pro'}</Text>
          </View>
          <Text style={styles.aiDescription}>
            {isPro
              ? 'Hosted Catch AI, cloud backup, offline maps, trip planner, and pattern alerts are unlocked.'
              : `One-time ${priceLabel} lifetime purchase. Hosted Catch AI (30 requests/day), cloud sync, offline maps, trip planner, and more.`}
          </Text>
          {PRO_LAUNCH_PROMO_ACTIVE && !isPro ? (
            <Text style={styles.promoNote}>Launch promo pricing — limited time</Text>
          ) : null}
          {!isPro ? (
            <>
              <Button
                title={purchasingPro ? 'Processing…' : `Unlock Pro — ${priceLabel}`}
                onPress={handlePurchasePro}
                loading={purchasingPro}
                style={styles.aiButton}
              />
              <Button
                title={restoringPro ? 'Restoring…' : 'Restore purchases'}
                onPress={handleRestorePro}
                loading={restoringPro}
                variant="secondary"
                style={styles.aiButton}
              />
            </>
          ) : (
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => router.push(PRO_UPGRADE_HREF)}
              accessibilityRole="button"
            >
              <Sparkles color={colors.accent} size={16} />
              <Text style={styles.linkText}>View Pro benefits</Text>
            </TouchableOpacity>
          )}
        </View>

        {cloudSyncAvailable ? (
          <>
            <Text style={styles.sectionLabel}>Account</Text>
            <View style={styles.card}>
              {user ? (
                <>
                  <View style={styles.actionRow}>
                    <UserRound color={colors.accent} size={18} />
                    <View style={styles.actionTextBlock}>
                      <Text style={styles.actionTitle}>{user.email ?? 'Signed in'}</Text>
                      <Text style={styles.actionSubtitle}>
                      {isPro
                        ? 'Catches and photos back up to your account automatically'
                        : 'Pro unlocks cloud backup for catches, photos, and waypoints'}
                    </Text>
                    </View>
                  </View>
                  <View style={styles.divider} />
                  <TouchableOpacity
                    style={styles.actionRow}
                    onPress={handleSignOut}
                    accessibilityRole="button"
                    accessibilityLabel="Sign out"
                  >
                    <LogOut color={colors.error} size={18} />
                    <View style={styles.actionTextBlock}>
                      <Text style={[styles.actionTitle, { color: colors.error }]}>Sign out</Text>
                      <Text style={styles.actionSubtitle}>
                        New catches stay on this device until you sign in again
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.divider} />
                  <TouchableOpacity
                    style={styles.actionRow}
                    onPress={handleDeleteAccount}
                    accessibilityRole="button"
                    accessibilityLabel="Delete account"
                  >
                    <UserX color={colors.error} size={18} />
                    <View style={styles.actionTextBlock}>
                      <Text style={[styles.actionTitle, { color: colors.error }]}>
                        Delete account
                      </Text>
                      <Text style={styles.actionSubtitle}>
                        Permanently remove your account and cloud data
                      </Text>
                    </View>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => router.push('/auth')}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in to back up and sync catches"
                >
                  <LogIn color={colors.accent} size={18} />
                  <View style={styles.actionTextBlock}>
                    <Text style={styles.actionTitle}>Sign in to back up & sync</Text>
                    <Text style={styles.actionSubtitle}>
                      {isPro
                        ? 'Your catch log and photos survive reinstalls; catches stay private by default.'
                        : 'Sign in after upgrading to Pro for cloud backup. Free tier keeps catches on this device.'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>Data</Text>
        <View style={styles.card}>
          {!cloudSync ? (
            <>
              <View style={styles.actionRow}>
                <Info color={colors.accent} size={18} />
                <View style={styles.actionTextBlock}>
                  <Text style={styles.actionTitle}>Stored on this device</Text>
                  <Text style={styles.actionSubtitle}>
                    {cloudSyncAvailable
                      ? 'Catches are saved locally. Sign in to back them up to the cloud.'
                      : 'Catches are saved locally and are not uploaded to the cloud.'}
                  </Text>
                </View>
              </View>
              <View style={styles.divider} />
            </>
          ) : null}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleExport}
            accessibilityRole="button"
            accessibilityLabel="Export catches"
          >
            <Download color={colors.accent} size={18} />
            <View style={styles.actionTextBlock}>
              <Text style={styles.actionTitle}>Export catches</Text>
              <Text style={styles.actionSubtitle}>Share your catch log as JSON or CSV</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleClearLocal}
            accessibilityRole="button"
            accessibilityLabel={cloudSync ? 'Clear locally saved catches' : 'Clear all catches'}
          >
            <Trash2 color={colors.error} size={18} />
            <View style={styles.actionTextBlock}>
              <Text style={[styles.actionTitle, { color: colors.error }]}>
                {cloudSync ? 'Clear local catches' : 'Clear all catches'}
              </Text>
              <Text style={styles.actionSubtitle}>
                {cloudSync
                  ? 'Remove device-only catches not yet synced'
                  : 'Remove every catch stored on this device'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Support</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/feedback')}
            accessibilityRole="button"
            accessibilityLabel="Send feedback"
          >
            <MessageSquare color={colors.accent} size={18} />
            <View style={styles.actionTextBlock}>
              <Text style={styles.actionTitle}>Send feedback</Text>
              <Text style={styles.actionSubtitle}>
                Report bugs, request features, or share your experience
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.card}>
          <View style={styles.actionRow}>
            <Info color={colors.accent} size={18} />
            <View style={styles.actionTextBlock}>
              <Text style={styles.actionTitle}>{Constants.expoConfig?.name ?? 'Fishing App'}</Text>
              <Text style={styles.actionSubtitle}>Version {appVersion}</Text>
            </View>
          </View>
          {privacyPolicyUrl ? (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.actionRow}
                onPress={handleOpenPrivacyPolicy}
                accessibilityRole="button"
                accessibilityLabel="Open privacy policy"
              >
                <Shield color={colors.accent} size={18} />
                <View style={styles.actionTextBlock}>
                  <Text style={styles.actionTitle}>Privacy policy</Text>
                  <Text style={styles.actionSubtitle}>How we handle your data</Text>
                </View>
              </TouchableOpacity>
            </>
          ) : null}
          {termsOfServiceUrl ? (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.actionRow}
                onPress={handleOpenTermsOfService}
                accessibilityRole="button"
                accessibilityLabel="Open terms of service"
              >
                <FileText color={colors.accent} size={18} />
                <View style={styles.actionTextBlock}>
                  <Text style={styles.actionTitle}>Terms of service</Text>
                  <Text style={styles.actionSubtitle}>Rules for using CatchMap</Text>
                </View>
              </TouchableOpacity>
            </>
          ) : null}
        </View>

        <View style={styles.bottomPadding} />
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
    brandRow: {
      alignItems: 'center',
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xs,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.md,
    },
    backButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      color: colors.text,
      fontSize: FontSizes.xxl,
      fontWeight: FontWeights.bold,
    },
    scroll: {
      flex: 1,
      paddingHorizontal: Spacing.lg,
    },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: FontSizes.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: FontWeights.semibold,
      marginTop: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: BorderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
    },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    rowSpacer: {
      marginTop: Spacing.md,
    },
    rowTitle: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.xs,
    },
    actionTextBlock: {
      flex: 1,
    },
    actionTitle: {
      color: colors.text,
      fontSize: FontSizes.md,
      fontWeight: FontWeights.semibold,
    },
    actionSubtitle: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: Spacing.sm,
    },
    aiDescription: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      lineHeight: 20,
      marginBottom: Spacing.sm,
    },
    promoNote: {
      color: colors.accent,
      fontSize: FontSizes.xs,
      fontWeight: FontWeights.semibold,
      marginBottom: Spacing.sm,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    linkText: {
      color: colors.accent,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    aiStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    aiStatusText: {
      color: colors.success,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.medium,
    },
    aiButton: {
      marginTop: Spacing.xs,
    },
    usageTitle: {
      color: colors.text,
      fontSize: FontSizes.sm,
      fontWeight: FontWeights.semibold,
      marginBottom: 4,
    },
    usageStats: {
      color: colors.textSecondary,
      fontSize: FontSizes.sm,
      marginBottom: Spacing.sm,
    },
    bottomPadding: {
      height: Spacing.xxl,
    },
  });
}
