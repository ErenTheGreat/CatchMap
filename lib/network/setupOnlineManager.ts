import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

let initialized = false;

function resolveIsOnline(state: {
  isConnected: boolean | null;
  isInternetReachable?: boolean | null;
}): boolean {
  if (state.isConnected !== true) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

export function setupOnlineManager(): void {
  if (initialized) return;
  initialized = true;

  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(resolveIsOnline(state));
    });
  });
}

export { resolveIsOnline };
