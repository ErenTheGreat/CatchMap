import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  loadRecentSpots,
  loadSavedSpots,
  removeSavedSpot,
  saveRecentSpots,
  saveSavedSpots,
  upsertRecentSpot,
  upsertSavedSpot,
} from '@/utils/savedSpotsStorage';
import type { RecentSpotSnapshot, SavedSpotSnapshot } from '@/lib/types/savedSpot';
import type { NearbySpot } from '@/utils/osmFishingSpots';

interface SavedSpotsContextValue {
  ready: boolean;
  savedSpots: SavedSpotSnapshot[];
  recentSpots: RecentSpotSnapshot[];
  isSaved: (spotId: string) => boolean;
  toggleSaved: (spot: NearbySpot) => void;
  recordRecent: (spot: NearbySpot) => void;
  removeSaved: (spotId: string) => void;
}

const SavedSpotsContext = createContext<SavedSpotsContextValue | null>(null);

export function SavedSpotsProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [savedSpots, setSavedSpots] = useState<SavedSpotSnapshot[]>([]);
  const [recentSpots, setRecentSpots] = useState<RecentSpotSnapshot[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadSavedSpots(), loadRecentSpots()]).then(([saved, recent]) => {
      if (cancelled) return;
      setSavedSpots(saved);
      setRecentSpots(recent);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isSaved = useCallback(
    (spotId: string) => savedSpots.some((spot) => spot.id === spotId),
    [savedSpots]
  );

  const toggleSaved = useCallback((spot: NearbySpot) => {
    setSavedSpots((prev) => {
      const exists = prev.some((item) => item.id === spot.id);
      const next = exists ? removeSavedSpot(prev, spot.id) : upsertSavedSpot(prev, spot);
      void saveSavedSpots(next);
      return next;
    });
  }, []);

  const removeSaved = useCallback((spotId: string) => {
    setSavedSpots((prev) => {
      const next = removeSavedSpot(prev, spotId);
      void saveSavedSpots(next);
      return next;
    });
  }, []);

  const recordRecent = useCallback((spot: NearbySpot) => {
    setRecentSpots((prev) => {
      const next = upsertRecentSpot(prev, spot);
      void saveRecentSpots(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      ready,
      savedSpots,
      recentSpots,
      isSaved,
      toggleSaved,
      recordRecent,
      removeSaved,
    }),
    [ready, savedSpots, recentSpots, isSaved, toggleSaved, recordRecent, removeSaved]
  );

  return (
    <SavedSpotsContext.Provider value={value}>{children}</SavedSpotsContext.Provider>
  );
}

export function useSavedSpots(): SavedSpotsContextValue {
  const context = useContext(SavedSpotsContext);
  if (!context) {
    throw new Error('useSavedSpots must be used within SavedSpotsProvider');
  }
  return context;
}
