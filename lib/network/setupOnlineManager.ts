import { onlineManager } from '@tanstack/react-query';
import { getSafeNetInfo } from '@/lib/network/safeNetInfo';
import { resolveIsOnline } from '@/lib/network/resolveIsOnline';

let initialized = false;

export function setupOnlineManager(): void {
  if (initialized) return;
  initialized = true;

  const netInfo = getSafeNetInfo();
  onlineManager.setEventListener((setOnline) => {
    return netInfo.addEventListener((state) => {
      setOnline(resolveIsOnline(state));
    });
  });
}

export { resolveIsOnline } from '@/lib/network/resolveIsOnline';
