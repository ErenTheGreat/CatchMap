export const API_CONFIG = {
  /** BFF base URL — when set, all third-party data routes through your backend proxy */
  bffUrl: process.env.EXPO_PUBLIC_BFF_URL?.replace(/\/$/, '') ?? '',
} as const;

export function isBffEnabled(): boolean {
  return API_CONFIG.bffUrl.length > 0;
}
