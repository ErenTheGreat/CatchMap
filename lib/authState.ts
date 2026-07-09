/**
 * Module-level mirror of the signed-in user id so non-React code
 * (utils/storage.ts, utils/catchStatus.ts) can check auth state
 * synchronously. AuthProvider keeps it up to date.
 */
let currentUserId: string | null = null;

export function setCurrentUserId(userId: string | null): void {
  currentUserId = userId;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}
