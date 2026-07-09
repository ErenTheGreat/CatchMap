import { NativeModules, Platform } from 'react-native';

export type NetInfoSnapshot = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
};

type NetInfoUnsubscribe = () => void;

export interface SafeNetInfo {
  fetch: () => Promise<NetInfoSnapshot>;
  addEventListener: (listener: (state: NetInfoSnapshot) => void) => NetInfoUnsubscribe;
}

const ONLINE_FALLBACK: NetInfoSnapshot = {
  isConnected: true,
  isInternetReachable: true,
};

const offlineFallback: SafeNetInfo = {
  fetch: async () => ONLINE_FALLBACK,
  addEventListener: () => () => {},
};

let cachedNetInfo: SafeNetInfo | null = null;

function wrapNativeNetInfo(native: {
  fetch: () => Promise<{
    isConnected?: boolean | null;
    isInternetReachable?: boolean | null;
  }>;
  addEventListener: (
    listener: (state: {
      isConnected?: boolean | null;
      isInternetReachable?: boolean | null;
    }) => void
  ) => NetInfoUnsubscribe;
}): SafeNetInfo {
  return {
    fetch: async () => {
      try {
        const state = await native.fetch();
        return {
          isConnected: state.isConnected ?? null,
          isInternetReachable: state.isInternetReachable ?? null,
        };
      } catch {
        return ONLINE_FALLBACK;
      }
    },
    addEventListener: (listener) => {
      try {
        return native.addEventListener((state) => {
          listener({
            isConnected: state.isConnected ?? null,
            isInternetReachable: state.isInternetReachable ?? null,
          });
        });
      } catch {
        return () => {};
      }
    },
  };
}

function hasNativeNetInfoModule(): boolean {
  return Boolean((NativeModules as { RNCNetInfo?: unknown }).RNCNetInfo);
}

/**
 * Lazily loads NetInfo so a missing native module does not crash route modules
 * during Metro hot reload or web/dev-client mismatches.
 */
export function getSafeNetInfo(): SafeNetInfo {
  if (cachedNetInfo) return cachedNetInfo;

  if (Platform.OS === 'web' || !hasNativeNetInfoModule()) {
    cachedNetInfo = offlineFallback;
    return cachedNetInfo;
  }

  try {
    const mod = require('@react-native-community/netinfo');
    const native = mod?.default ?? mod;
    if (native && typeof native.fetch === 'function') {
      cachedNetInfo = wrapNativeNetInfo(native);
      return cachedNetInfo;
    }
  } catch {
    // Native module unavailable — fall back to "online" so the app still boots.
  }

  cachedNetInfo = offlineFallback;
  return cachedNetInfo;
}
