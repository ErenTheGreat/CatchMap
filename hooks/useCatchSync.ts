import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isCloudSyncEnabled } from '@/constants/features';
import { fishingApi } from '@/lib/api/fishingApi';
import { useToast } from '@/components/ui';
import { useNetworkStatus } from '@/providers/NetworkProvider';

const CATCHES_KEY = ['catches'];
const SYNC_COOLDOWN_MS = 30_000;

/** Background sync for catches saved locally while offline. */
export function useCatchSync() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { isOnline } = useNetworkStatus();
  const lastSyncAtRef = useRef(0);
  const syncingRef = useRef(false);
  const wasOfflineRef = useRef(false);
  const cloudSync = isCloudSyncEnabled();

  const syncMutation = useMutation({
    mutationFn: () => fishingApi.syncPendingCatches(),
    onSuccess: (result) => {
      if (result.synced > 0) {
        queryClient.invalidateQueries({ queryKey: CATCHES_KEY });
        showToast({
          message:
            result.synced === 1
              ? '1 catch synced to the cloud'
              : `${result.synced} catches synced to the cloud`,
          variant: 'success',
        });
      }
    },
  });

  const runSync = (force = false) => {
    if (!cloudSync || !isOnline) return;
    if (syncingRef.current) return;
    const now = Date.now();
    if (!force && now - lastSyncAtRef.current < SYNC_COOLDOWN_MS) return;

    syncingRef.current = true;
    lastSyncAtRef.current = now;
    syncMutation.mutate(undefined, {
      onSettled: () => {
        syncingRef.current = false;
      },
    });
  };

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      return;
    }

    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      runSync(true);
    }
  }, [isOnline]);

  useEffect(() => {
    runSync(true);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        runSync();
      }
    });

    return () => subscription.remove();
  }, [isOnline]);
}

/** Mount once at app root to enable background catch sync. */
export function CatchSyncRunner() {
  useCatchSync();
  return null;
}
