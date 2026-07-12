import type { Router } from 'expo-router';
import type { ToastOptions } from '@/components/ui/ToastProvider';
import type { SaveResult } from '@/utils/storage';

type ShowToast = (options: ToastOptions) => void;

interface CatchSaveFeedbackOptions {
  result: SaveResult;
  showToast: ShowToast;
  router: Router;
  isOnline: boolean;
  cloudSyncEnabled: boolean;
  onRetrySync: () => void;
  onSuccessHaptic?: () => void;
  onWarningHaptic?: () => void;
}

/**
 * Consistent post-save toast for Map + Log tabs.
 * Offers Retry sync when cloud backup failed but the device is online.
 */
export function showCatchSavedFeedback({
  result,
  showToast,
  router,
  isOnline,
  cloudSyncEnabled,
  onRetrySync,
  onSuccessHaptic,
  onWarningHaptic,
}: CatchSaveFeedbackOptions): void {
  const viewHistoryAction = {
    actionLabel: 'View in History',
    onAction: () => router.push('/history'),
  } as const;

  if (result.synced) {
    onSuccessHaptic?.();
    showToast({
      message: 'Your catch has been logged!',
      variant: 'success',
      ...viewHistoryAction,
    });
    return;
  }

  onWarningHaptic?.();

  if (cloudSyncEnabled && isOnline) {
    showToast({
      message: 'Saved on this device — cloud sync is pending',
      variant: 'warning',
      duration: 6000,
      actionLabel: 'Retry sync',
      onAction: onRetrySync,
    });
    return;
  }

  showToast({
    message: 'Saved on this device — will sync when online',
    variant: 'warning',
    ...viewHistoryAction,
  });
}
