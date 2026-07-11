/* eslint-disable import/no-duplicates -- side-effect import must precede named import */
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
/* eslint-enable import/no-duplicates */
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, View } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import { ThemeProvider, useTheme } from '@/providers/ThemeProvider';
import { FontProvider } from '@/providers/FontProvider';
import { OnboardingProvider, useOnboarding } from '@/providers/OnboardingProvider';
import { UnitsProvider } from '@/providers/UnitsProvider';
import { LogFormGuardProvider } from '@/providers/LogFormGuardProvider';
import { SavedSpotsProvider } from '@/providers/SavedSpotsProvider';
import { ProProvider } from '@/providers/ProProvider';
import { AppErrorBoundary, ToastProvider } from '@/components/ui';
import { CatchSyncRunner } from '@/hooks/useCatchSync';
import { WaypointSyncRunner } from '@/hooks/useWaypoints';
import { usePatternMatchAlerts } from '@/hooks/usePatternMatchAlerts';
import { isPatternAlertsEnabled } from '@/constants/features';
import { TripFeedbackPrompt } from '@/components/trip/TripFeedbackPrompt';
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';
import { initSentry, wrapRoot } from '@/lib/sentry';

initSentry();

SplashScreen.preventAutoHideAsync().catch(() => {});

// Anchor the root navigator to the (tabs) group so that the empty root path ("/")
// deterministically resolves to app/(tabs)/index on a native cold start. Without
// this, Expo Router's path matcher can fail to descend into the group for "/" and
// fall through to the +not-found catch-all (works on web, breaks on Android dev client).
export const unstable_settings = {
  anchor: '(tabs)',
};

function AuthRecoveryRedirect() {
  const { recoveryMode } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!recoveryMode) return;
    if (segments[0] !== 'auth') {
      router.push('/auth');
    }
  }, [recoveryMode, segments, router]);

  return null;
}

function RootLayoutContent() {
  const { colors, isDark, isOutdoor } = useTheme();
  const { status } = useOnboarding();
  usePatternMatchAlerts(status === 'complete' && isPatternAlertsEnabled());

  return (
    <ToastProvider>
      <LogFormGuardProvider>
        <AuthRecoveryRedirect />
        <CatchSyncRunner />
        <WaypointSyncRunner />
        <TripFeedbackPrompt />
        <GestureHandlerRootView style={[styles.root, { backgroundColor: colors.background }]}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="pro-upgrade" />
            <Stack.Screen name="trip-planner" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="feedback" />
            <Stack.Screen name="+not-found" />
          </Stack>

          {status === 'loading' ? (
            <View
              style={[styles.overlay, { backgroundColor: colors.background }]}
              pointerEvents="none"
            />
          ) : null}

          {status === 'pending' ? (
            <View style={[styles.overlay, { backgroundColor: colors.background }]}>
              <OnboardingFlow />
            </View>
          ) : null}

          <StatusBar style={isOutdoor || !isDark ? 'dark' : 'light'} />
        </GestureHandlerRootView>
      </LogFormGuardProvider>
    </ToastProvider>
  );
}

function RootLayout() {
  useFrameworkReady();

  return (
    <AppErrorBoundary>
      <QueryProvider>
        <AuthProvider>
          <ProProvider>
            <ThemeProvider>
            <FontProvider>
              <UnitsProvider>
                <OnboardingProvider>
                  <SavedSpotsProvider>
                    <RootLayoutContent />
                  </SavedSpotsProvider>
                </OnboardingProvider>
              </UnitsProvider>
            </FontProvider>
            </ThemeProvider>
          </ProProvider>
        </AuthProvider>
      </QueryProvider>
    </AppErrorBoundary>
  );
}

export default wrapRoot(RootLayout);

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
