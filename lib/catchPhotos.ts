import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';

const BUCKET = 'catch-photos';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const byteLength = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(byteLength);

  let byteIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = BASE64_CHARS.indexOf(clean[i]);
    const b = BASE64_CHARS.indexOf(clean[i + 1]);
    const c = i + 2 < clean.length ? BASE64_CHARS.indexOf(clean[i + 2]) : -1;
    const d = i + 3 < clean.length ? BASE64_CHARS.indexOf(clean[i + 3]) : -1;

    bytes[byteIndex++] = (a << 2) | (b >> 4);
    if (c >= 0) bytes[byteIndex++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) bytes[byteIndex++] = ((c & 3) << 6) | d;
  }

  return bytes;
}

function extensionFromUri(uri: string): string {
  const match = uri.match(/\.(\w+)(?:\?.*)?$/);
  const ext = match ? match[1].toLowerCase() : 'jpg';
  return ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext) ? ext : 'jpg';
}

function contentTypeForExtension(ext: string): string {
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    default:
      return 'image/jpeg';
  }
}

/** True when a photoUri points at a device-local file (vs a remote URL). */
export function isLocalPhotoUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return !/^https?:\/\//i.test(uri);
}

/**
 * Best-effort upload of a local catch photo to the private catch-photos
 * bucket. Returns the storage path on success, or null on any failure —
 * callers must never block the catch save on this.
 */
export async function uploadCatchPhoto(
  localUri: string,
  userId: string,
  clientId: string
): Promise<string | null> {
  try {
    const ext = extensionFromUri(localUri);
    const path = `${userId}/${clientId}.${ext}`;
    const contentType = contentTypeForExtension(ext);

    let body: Uint8Array | ArrayBuffer | Blob;
    if (Platform.OS === 'web') {
      const response = await fetch(localUri);
      body = await response.blob();
    } else {
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: 'base64',
      });
      body = base64ToBytes(base64);
    }

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, body, { contentType, upsert: true });

    if (error) {
      if (__DEV__) console.warn('Catch photo upload failed:', error.message);
      return null;
    }
    return path;
  } catch (error) {
    if (__DEV__) console.warn('Catch photo upload failed:', error);
    return null;
  }
}

/**
 * Batch-resolves signed URLs for cloud photo paths (used when the local file
 * is gone, e.g. after a reinstall). Returns a map of path -> signed URL.
 */
export async function createSignedPhotoUrls(
  paths: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (paths.length === 0) return result;

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

    if (error || !data) return result;
    for (const entry of data) {
      if (entry.signedUrl && entry.path) {
        result.set(entry.path, entry.signedUrl);
      }
    }
  } catch {
    // Offline or storage unavailable — photos simply fall back to local URIs.
  }
  return result;
}
