import AsyncStorage from '@react-native-async-storage/async-storage';
import { isCloudSyncEnabled } from '@/constants/features';
import { getCurrentUserId } from '@/lib/authState';
import { supabase } from '@/lib/supabase';
import {
  generateWaypointId,
  getMaxWaypointsLimit,
  type WaypointRecord,
} from '@/lib/types/waypoint';

const WAYPOINTS_KEY = '@waypoints_v1';

export interface SaveWaypointInput {
  name: string;
  notes?: string;
  latitude: number;
  longitude: number;
}

export interface SyncWaypointsResult {
  synced: number;
  failed: number;
}

interface WaypointRow {
  id: string;
  client_id: string | null;
  name: string;
  notes: string | null;
  latitude: number;
  longitude: number;
  created_at: string;
  updated_at: string;
}

function mapWaypointRow(row: WaypointRow, clientId: string): WaypointRecord {
  return {
    id: clientId,
    name: row.name,
    notes: row.notes ?? '',
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export function isLocalOnlyWaypoint(id: string): boolean {
  return id.startsWith('wp_');
}

/** Merge cloud waypoints with unsynced local wp_* records (mirrors catch sync). */
export function mergeWaypointsLocalAndRemote(
  local: WaypointRecord[],
  remote: WaypointRecord[]
): WaypointRecord[] {
  const pendingLocal = local.filter((item) => isLocalOnlyWaypoint(item.id));
  const remoteIds = new Set(remote.map((item) => item.id));
  const stillPending = pendingLocal.filter((item) => !remoteIds.has(item.id));

  const seen = new Set<string>();
  const merged: WaypointRecord[] = [];

  for (const record of [...stillPending, ...remote]) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    merged.push(record);
    if (merged.length >= getMaxWaypointsLimit()) break;
  }

  return merged;
}

export async function getWaypointsLocal(): Promise<WaypointRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(WAYPOINTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WaypointRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (__DEV__) console.warn('[waypoints] corrupt local storage, resetting:', error);
    return [];
  }
}

async function persistWaypointsLocal(waypoints: WaypointRecord[]): Promise<void> {
  await AsyncStorage.setItem(WAYPOINTS_KEY, JSON.stringify(waypoints));
}

async function pushWaypointToSupabase(record: WaypointRecord): Promise<WaypointRecord | null> {
  const userId = getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('waypoints')
    .upsert(
      [
        {
          user_id: userId,
          client_id: record.id,
          name: record.name,
          notes: record.notes || null,
          latitude: record.latitude,
          longitude: record.longitude,
        },
      ],
      { onConflict: 'client_id' }
    )
    .select()
    .single();

  if (error || !data) {
    if (__DEV__) console.error('Failed to sync waypoint:', error);
    return null;
  }

  return mapWaypointRow(data as WaypointRow, record.id);
}

export async function syncPendingWaypoints(): Promise<SyncWaypointsResult> {
  if (!isCloudSyncEnabled()) {
    return { synced: 0, failed: 0 };
  }

  const local = await getWaypointsLocal();
  const pending = local.filter((item) => isLocalOnlyWaypoint(item.id));
  if (pending.length === 0) {
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  for (const record of pending) {
    const remote = await pushWaypointToSupabase(record);
    if (remote) {
      synced += 1;
    } else {
      failed += 1;
    }
  }

  return { synced, failed };
}

export async function pullWaypointsFromCloud(): Promise<WaypointRecord[]> {
  const userId = getCurrentUserId();
  if (!isCloudSyncEnabled() || !userId) {
    return getWaypointsLocal();
  }

  const local = await getWaypointsLocal();

  const { data, error } = await supabase
    .from('waypoints')
    .select('id, client_id, name, notes, latitude, longitude, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(getMaxWaypointsLimit());

  if (error || !data) {
    if (__DEV__) console.error('Failed to pull waypoints:', error);
    return local;
  }

  const remote = (data as WaypointRow[]).map((row) =>
    mapWaypointRow(row, row.client_id ?? row.id)
  );
  const merged = mergeWaypointsLocalAndRemote(local, remote);
  await persistWaypointsLocal(merged);
  return merged;
}

export async function saveWaypoint(input: SaveWaypointInput): Promise<WaypointRecord> {
  const now = Date.now();
  const record: WaypointRecord = {
    id: generateWaypointId(),
    name: input.name.trim() || 'My spot',
    notes: input.notes?.trim() ?? '',
    latitude: input.latitude,
    longitude: input.longitude,
    createdAt: now,
    updatedAt: now,
  };

  const local = await getWaypointsLocal();
  const next = [record, ...local].slice(0, getMaxWaypointsLimit());
  await persistWaypointsLocal(next);

  if (isCloudSyncEnabled()) {
    await pushWaypointToSupabase(record);
  }

  return record;
}

export async function updateWaypoint(
  id: string,
  changes: Partial<Pick<WaypointRecord, 'name' | 'notes'>>
): Promise<WaypointRecord | null> {
  const local = await getWaypointsLocal();
  const index = local.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const updated: WaypointRecord = {
    ...local[index],
    ...changes,
    name: changes.name?.trim() || local[index].name,
    notes: changes.notes !== undefined ? changes.notes.trim() : local[index].notes,
    updatedAt: Date.now(),
  };

  const next = [...local];
  next[index] = updated;
  await persistWaypointsLocal(next);

  if (isCloudSyncEnabled()) {
    await pushWaypointToSupabase(updated);
  }

  return updated;
}

export async function deleteWaypoint(id: string): Promise<void> {
  const local = await getWaypointsLocal();
  const next = local.filter((item) => item.id !== id);
  await persistWaypointsLocal(next);

  if (isCloudSyncEnabled()) {
    const userId = getCurrentUserId();
    if (userId) {
      await supabase.from('waypoints').delete().eq('user_id', userId).eq('client_id', id);
    }
  }
}

export async function clearAllWaypoints(): Promise<void> {
  await AsyncStorage.removeItem(WAYPOINTS_KEY);
}
