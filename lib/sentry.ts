import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ?? '';

let initialized = false;

/** Initialize crash reporting when a DSN is configured. Safe to call multiple times. */
export function initSentry(): void {
  if (initialized || !dsn) return;

  Sentry.init({
    dsn,
    enabled: !__DEV__,
    environment: process.env.APP_VARIANT ?? (__DEV__ ? 'development' : 'production'),
    release: Constants.expoConfig?.version
      ? `catchmap@${Constants.expoConfig.version}`
      : undefined,
    tracesSampleRate: 0.15,
    sendDefaultPii: false,
  });

  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!dsn || !initialized) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export { Sentry };
