import { isCloudSyncEnabled } from '@/constants/features';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isOptimisticCatch(id: string): boolean {
  return id.startsWith('optimistic-');
}

/** Catches stored locally when Supabase is unavailable. */
export function isLocalOnlyCatch(id: string): boolean {
  return !isOptimisticCatch(id) && !UUID_PATTERN.test(id);
}

export function getCatchSyncLabel(id: string): string | null {
  if (!isCloudSyncEnabled()) return null;
  if (isOptimisticCatch(id)) return 'Saving…';
  if (isLocalOnlyCatch(id)) return 'Saved locally';
  return null;
}
