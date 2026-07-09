import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useNetworkStatus } from '@/providers/NetworkProvider';
import { isCloudSyncEnabled } from '@/constants/features';
import { useToast } from '@/components/ui';
import type { WaypointRecord } from '@/lib/types/waypoint';
import {
  deleteWaypoint,
  getWaypointsLocal,
  pullWaypointsFromCloud,
  saveWaypoint,
  syncPendingWaypoints,
  updateWaypoint,
  type SaveWaypointInput,
} from '@/utils/waypointsStorage';

const WAYPOINTS_KEY = ['waypoints'];

export function useWaypoints() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const cloudSync = isCloudSyncEnabled();

  const query = useQuery({
    queryKey: WAYPOINTS_KEY,
    queryFn: async () => {
      if (cloudSync && isOnline) {
        return pullWaypointsFromCloud();
      }
      return getWaypointsLocal();
    },
    staleTime: 60_000,
  });

  const handleSyncResult = useCallback(
    (result: { synced: number; failed: number }) => {
      if (result.synced > 0) {
        void queryClient.invalidateQueries({ queryKey: WAYPOINTS_KEY });
        showToast({
          message:
            result.synced === 1
              ? '1 waypoint synced to the cloud'
              : `${result.synced} waypoints synced to the cloud`,
          variant: 'success',
        });
      } else if (result.failed > 0) {
        showToast({
          message: 'Could not sync waypoints to the cloud',
          variant: 'error',
        });
      }
    },
    [queryClient, showToast]
  );

  useEffect(() => {
    if (!cloudSync || !isOnline || !user) return;
    void syncPendingWaypoints().then(handleSyncResult);
  }, [cloudSync, isOnline, user?.id, handleSyncResult]);

  const saveMutation = useMutation({
    mutationFn: (input: SaveWaypointInput) => saveWaypoint(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: WAYPOINTS_KEY });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      changes,
    }: {
      id: string;
      changes: Partial<Pick<WaypointRecord, 'name' | 'notes'>>;
    }) => updateWaypoint(id, changes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: WAYPOINTS_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWaypoint(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: WAYPOINTS_KEY });
    },
  });

  const waypoints = useMemo(() => query.data ?? [], [query.data]);

  const flyToWaypoint = useCallback((waypoint: WaypointRecord) => waypoint, []);

  return {
    waypoints,
    isLoading: query.isLoading,
    saveWaypoint: saveMutation.mutateAsync,
    updateWaypoint: updateMutation.mutateAsync,
    deleteWaypoint: deleteMutation.mutateAsync,
    saving: saveMutation.isPending,
    flyToWaypoint,
  };
}

/** Mount once at app root to sync pending waypoints after reconnect. */
export function WaypointSyncRunner() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isCloudSyncEnabled() || !isOnline || !user) return;
    void syncPendingWaypoints().then((result) => {
      if (result.synced > 0) {
        void queryClient.invalidateQueries({ queryKey: ['waypoints'] });
        showToast({
          message:
            result.synced === 1
              ? '1 waypoint synced to the cloud'
              : `${result.synced} waypoints synced to the cloud`,
          variant: 'success',
        });
      } else if (result.failed > 0) {
        showToast({
          message: 'Could not sync waypoints to the cloud',
          variant: 'error',
        });
      }
    });
  }, [isOnline, user?.id, queryClient, showToast]);

  return null;
}
