import { useCallback, useEffect, useState } from 'react';
import {
  downloadOfflineRegion,
  getOfflineRegionStatus,
  isOfflineMapsAvailable,
  removeOfflineRegion,
} from '@/lib/offline/offlineTiles';
import { useTheme } from '@/providers/ThemeProvider';

export type OfflineMapState =
  | 'unavailable'
  | 'idle'
  | 'downloading'
  | 'complete'
  | 'error';

export function useOfflineMap(latitude?: number | null, longitude?: number | null) {
  const { isDark } = useTheme();
  const [state, setState] = useState<OfflineMapState>(
    isOfflineMapsAvailable() ? 'idle' : 'unavailable'
  );
  const [percentage, setPercentage] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (state === 'unavailable') return;

    getOfflineRegionStatus()
      .then((status) => {
        if (!status) return;
        if (status.state === 'complete' || status.percentage >= 100) {
          setState('complete');
          setPercentage(100);
        } else if (status.state === 'active') {
          setState('downloading');
          setPercentage(status.percentage);
        }
      })
      .catch(() => {
        // No pack yet — stay idle
      });
  }, []);

  const download = useCallback(async () => {
    if (latitude == null || longitude == null || state === 'downloading') return;

    setState('downloading');
    setPercentage(0);
    setErrorMessage(null);

    await downloadOfflineRegion(
      latitude,
      longitude,
      25,
      (status) => {
        setPercentage(Math.round(status.percentage));
        if (status.state === 'complete' || status.percentage >= 100) {
          setState('complete');
        }
      },
      (message) => {
        setErrorMessage(message);
        setState('error');
      },
      isDark
    );
  }, [latitude, longitude, state, isDark]);

  const remove = useCallback(async () => {
    await removeOfflineRegion();
    setState('idle');
    setPercentage(0);
  }, []);

  return { state, percentage, errorMessage, download, remove };
}
