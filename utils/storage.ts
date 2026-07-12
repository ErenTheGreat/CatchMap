import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { isCloudSyncEnabled } from '@/constants/features';
import { getCurrentUserId } from '@/lib/authState';
import {
  createSignedPhotoUrls,
  isLocalPhotoUri,
  uploadCatchPhoto,
} from '@/lib/catchPhotos';
import { supabase } from '@/lib/supabase';
import { isLocalOnlyCatch, isOptimisticCatch } from '@/utils/catchStatus';

const CATCHES_KEY = '@fishing_catches';

/** Snapshot of the conditions at the moment a catch was logged. */
export interface CatchConditions {
  temperatureF?: number;
  windSpeedMph?: number;
  cloudCoverPercent?: number;
  pressureMb?: number;
  pressureTrend?: 'falling' | 'rising' | 'stable';
  skyLabel?: string;
  tideNote?: string;
  moonPhaseLabel?: string;
}

export interface CatchRecord {
  id: string;
  species: string;
  speciesId: string;
  weight: string;
  lure: string;
  notes: string;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  date: string;
  createdAt: number;
  photoUri?: string | null;
  length?: string | null;
  conditions?: CatchConditions | null;
  /** Per-catch opt-in to contribute anonymized data to community aggregates. */
  sharedAnonymously?: boolean;
}

export interface SaveResult {
  record: CatchRecord;
  synced: boolean;
}

export interface SyncPendingResult {
  synced: number;
  failed: number;
}

function generateLocalId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

interface CatchLogRow {
  id: string;
  client_id: string | null;
  species_name: string | null;
  species_client_id: string | null;
  weight: string;
  lure_used: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  length: string | null;
  photo_uri: string | null;
  photo_url: string | null;
  conditions: CatchConditions | null;
  shared_anonymously: boolean | null;
  caught_at_timestamp: string;
}

/**
 * Picks the best displayable photo URI for a synced catch: the device-local
 * copy when it belongs to this install, otherwise a signed cloud URL.
 */
function resolvePhotoUri(
  row: CatchLogRow,
  signedUrls: Map<string, string>
): string | null {
  const localUri = row.photo_uri;
  const documentDirectory = FileSystem.documentDirectory;
  if (localUri && documentDirectory && localUri.startsWith(documentDirectory)) {
    return localUri;
  }
  if (row.photo_url) {
    const signed = signedUrls.get(row.photo_url);
    if (signed) return signed;
  }
  return localUri;
}

function mapCatchLogRow(
  row: CatchLogRow,
  signedUrls: Map<string, string>
): CatchRecord {
  const caughtAt = new Date(row.caught_at_timestamp).getTime();
  return {
    id: String(row.id),
    species: row.species_name ?? '',
    speciesId: row.species_client_id ?? '',
    weight: String(row.weight),
    lure: row.lure_used ?? '',
    notes: row.notes ?? '',
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    locationName: row.location_name,
    date: new Date(caughtAt).toLocaleDateString(),
    createdAt: caughtAt,
    photoUri: resolvePhotoUri(row, signedUrls),
    length: row.length,
    conditions: row.conditions,
    sharedAnonymously: row.shared_anonymously ?? false,
  };
}

function sortCatchesNewestFirst(catches: CatchRecord[]): CatchRecord[] {
  return [...catches].sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Best-effort upload of a local photo to cloud storage. Returns the storage
 * path, or null when there is nothing to upload or the upload failed (the
 * catch record sync proceeds either way).
 */
async function maybeUploadPhoto(
  photoUri: string | null | undefined,
  userId: string,
  clientId: string
): Promise<string | null> {
  if (!photoUri || !isLocalPhotoUri(photoUri)) return null;
  return uploadCatchPhoto(photoUri, userId, clientId);
}

function buildCatchLogPayload(
  data: Omit<CatchRecord, 'id' | 'createdAt' | 'date'>,
  options: {
    userId: string;
    clientId: string;
    caughtAt: number;
    photoUrl: string | null;
  }
): Record<string, unknown> {
  return {
    user_id: options.userId,
    client_id: options.clientId,
    species_name: data.species,
    species_client_id: data.speciesId || null,
    weight: data.weight,
    lure_used: data.lure || null,
    notes: data.notes || null,
    latitude: data.latitude,
    longitude: data.longitude,
    location_name: data.locationName || null,
    length: data.length || null,
    photo_uri: data.photoUri || null,
    photo_url: options.photoUrl,
    conditions: data.conditions ?? null,
    shared_anonymously: data.sharedAnonymously ?? false,
    caught_at_timestamp: new Date(options.caughtAt).toISOString(),
  };
}

async function pushLocalCatchToSupabase(record: CatchRecord): Promise<CatchRecord | null> {
  const userId = getCurrentUserId();
  if (!userId) return null;

  // The local id doubles as the idempotent client_id, so re-running a
  // partially failed sync upserts instead of duplicating.
  const photoUrl = await maybeUploadPhoto(record.photoUri, userId, record.id);

  const { data, error } = await supabase
    .from('catch_logs')
    .upsert(
      [
        buildCatchLogPayload(record, {
          userId,
          clientId: record.id,
          caughtAt: record.createdAt,
          photoUrl,
        }),
      ],
      { onConflict: 'client_id' }
    )
    .select()
    .single();

  if (error || !data) {
    console.error('Failed to sync local catch:', error);
    return null;
  }

  return mapCatchLogRow(data as CatchLogRow, new Map());
}

export async function syncPendingCatches(): Promise<SyncPendingResult> {
  if (!isCloudSyncEnabled()) {
    return { synced: 0, failed: 0 };
  }

  const localCatches = await getCatchesLocal();
  const pending = localCatches.filter((c) => isLocalOnlyCatch(c.id));

  if (pending.length === 0) {
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;
  const syncedLocalIds = new Set<string>();

  for (const record of pending) {
    const remote = await pushLocalCatchToSupabase(record);
    if (remote) {
      syncedLocalIds.add(record.id);
      synced += 1;
    } else {
      failed += 1;
    }
  }

  if (syncedLocalIds.size > 0) {
    const remaining = localCatches.filter((c) => !syncedLocalIds.has(c.id));
    await AsyncStorage.setItem(CATCHES_KEY, JSON.stringify(remaining));
  }

  return { synced, failed };
}

/** Fields accepted when creating a catch. `caughtAt` overrides the timestamp. */
export type SaveCatchInput = Omit<CatchRecord, 'id' | 'createdAt'> & {
  caughtAt?: number;
};

// Database-backed storage
export const saveCatch = async (
  catchData: SaveCatchInput
): Promise<SaveResult> => {
  const userId = getCurrentUserId();
  if (!isCloudSyncEnabled() || !userId) {
    const record = await saveCatchLocal(catchData);
    return { record, synced: false };
  }

  const caughtAt = catchData.caughtAt ?? Date.now();
  const clientId = generateLocalId();

  try {
    const photoUrl = await maybeUploadPhoto(catchData.photoUri, userId, clientId);

    const { data, error } = await supabase
      .from('catch_logs')
      .upsert(
        [
          buildCatchLogPayload(catchData, {
            userId,
            clientId,
            caughtAt,
            photoUrl,
          }),
        ],
        { onConflict: 'client_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Supabase error, falling back to local:', error);
      const record = await saveCatchLocal(catchData);
      return { record, synced: false };
    }

    return {
      record: mapCatchLogRow(data as CatchLogRow, new Map()),
      synced: true,
    };
  } catch (error) {
    console.error('Error saving catch, falling back to local:', error);
    const record = await saveCatchLocal(catchData);
    return { record, synced: false };
  }
};

const saveCatchLocal = async (
  catchData: SaveCatchInput
): Promise<CatchRecord> => {
  const { caughtAt, ...rest } = catchData;
  const createdAt = caughtAt ?? Date.now();
  const newCatch: CatchRecord = {
    ...rest,
    id: generateLocalId(),
    createdAt,
    date: new Date(createdAt).toLocaleDateString(),
  };

  const existingCatches = await getCatchesLocal();
  const updatedCatches = [newCatch, ...existingCatches];
  await AsyncStorage.setItem(CATCHES_KEY, JSON.stringify(updatedCatches));
  return newCatch;
};

export const getCatches = async (): Promise<CatchRecord[]> => {
  const localCatches = await getCatchesLocal();
  if (!isCloudSyncEnabled()) {
    return sortCatchesNewestFirst(localCatches);
  }

  const pendingLocal = localCatches.filter((c) => isLocalOnlyCatch(c.id));

  try {
    const { data, error } = await supabase
      .from('catch_logs')
      .select('*')
      .order('caught_at_timestamp', { ascending: false });

    if (error) {
      console.error('Supabase error, falling back to local:', error);
      return sortCatchesNewestFirst(localCatches);
    }

    const rows = (data || []) as CatchLogRow[];

    // Resolve signed URLs only for rows whose local photo is not on this
    // device (e.g. after a reinstall or on a second device).
    const documentDirectory = FileSystem.documentDirectory;
    const pathsNeedingUrls = rows
      .filter(
        (row) =>
          row.photo_url &&
          !(row.photo_uri && documentDirectory && row.photo_uri.startsWith(documentDirectory))
      )
      .map((row) => row.photo_url as string);
    const signedUrls = await createSignedPhotoUrls(pathsNeedingUrls);

    const remote = rows.map((row) => mapCatchLogRow(row, signedUrls));
    return sortCatchesNewestFirst([...pendingLocal, ...remote]);
  } catch (error) {
    console.error('Error getting catches, falling back to local:', error);
    return sortCatchesNewestFirst(localCatches);
  }
};

const getCatchesLocal = async (): Promise<CatchRecord[]> => {
  try {
    const catches = await AsyncStorage.getItem(CATCHES_KEY);
    return catches ? JSON.parse(catches) : [];
  } catch (error) {
    console.error('Error getting local catches:', error);
    return [];
  }
};

export interface DeleteCatchResult {
  cloudDeleteFailed: boolean;
}

export const deleteCatch = async (id: string): Promise<DeleteCatchResult> => {
  let cloudDeleteFailed = false;

  if (isCloudSyncEnabled() && !isLocalOnlyCatch(id)) {
    try {
      const { error } = await supabase.from('catch_logs').delete().eq('id', id);

      if (error) {
        console.error('Supabase delete error:', error);
        cloudDeleteFailed = true;
      }
    } catch (error) {
      console.error('Error deleting catch:', error);
      cloudDeleteFailed = true;
    }
  }

  try {
    const existingCatches = await getCatchesLocal();
    const updatedCatches = existingCatches.filter((c) => c.id !== id);
    await AsyncStorage.setItem(CATCHES_KEY, JSON.stringify(updatedCatches));
  } catch (error) {
    console.error('Error deleting local catch:', error);
    throw error;
  }

  return { cloudDeleteFailed };
};

/** Fields that can be edited on an existing catch. */
export type UpdateCatchInput = Partial<
  Pick<
    CatchRecord,
    | 'species'
    | 'speciesId'
    | 'weight'
    | 'lure'
    | 'notes'
    | 'latitude'
    | 'longitude'
    | 'locationName'
    | 'photoUri'
    | 'length'
    | 'conditions'
    | 'sharedAnonymously'
  >
> & { caughtAt?: number };

export const updateCatch = async (
  id: string,
  changes: UpdateCatchInput
): Promise<CatchRecord | null> => {
  const userId = getCurrentUserId();
  if (isCloudSyncEnabled() && userId && !isLocalOnlyCatch(id) && !isOptimisticCatch(id)) {
    try {
      const payload: Record<string, unknown> = {};
      if (changes.species !== undefined) payload.species_name = changes.species;
      if (changes.speciesId !== undefined)
        payload.species_client_id = changes.speciesId || null;
      if (changes.weight !== undefined) payload.weight = changes.weight;
      if (changes.lure !== undefined) payload.lure_used = changes.lure || null;
      if (changes.notes !== undefined) payload.notes = changes.notes || null;
      if (changes.latitude !== undefined) payload.latitude = changes.latitude;
      if (changes.longitude !== undefined) payload.longitude = changes.longitude;
      if (changes.locationName !== undefined)
        payload.location_name = changes.locationName || null;
      if (changes.photoUri !== undefined) {
        payload.photo_uri = changes.photoUri || null;
        const photoUrl = changes.photoUri
          ? await maybeUploadPhoto(changes.photoUri, userId, id)
          : null;
        payload.photo_url = photoUrl;
      }
      if (changes.length !== undefined) payload.length = changes.length || null;
      if (changes.conditions !== undefined) payload.conditions = changes.conditions ?? null;
      if (changes.sharedAnonymously !== undefined)
        payload.shared_anonymously = changes.sharedAnonymously;
      if (changes.caughtAt !== undefined)
        payload.caught_at_timestamp = new Date(changes.caughtAt).toISOString();

      const { data, error } = await supabase
        .from('catch_logs')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        return mapCatchLogRow(data as CatchLogRow, new Map());
      }
      console.error('Supabase update error, falling back to local:', error);
    } catch (error) {
      console.error('Error updating catch remotely, falling back to local:', error);
    }
  }

  try {
    const existingCatches = await getCatchesLocal();
    let updated: CatchRecord | null = null;
    const nextCatches = existingCatches.map((c) => {
      if (c.id !== id) return c;
      const { caughtAt, ...rest } = changes;
      updated = {
        ...c,
        ...rest,
        ...(caughtAt !== undefined
          ? { createdAt: caughtAt, date: new Date(caughtAt).toLocaleDateString() }
          : {}),
      };
      return updated;
    });
    await AsyncStorage.setItem(CATCHES_KEY, JSON.stringify(nextCatches));
    return updated;
  } catch (error) {
    console.error('Error updating local catch:', error);
    return null;
  }
};

export const clearAllCatches = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CATCHES_KEY);
  } catch (error) {
    console.error('Error clearing catches:', error);
  }
};
