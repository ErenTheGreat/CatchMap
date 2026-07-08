import { describe, expect, it } from 'vitest';
import { resolveIsOnline } from '@/lib/network/setupOnlineManager';

describe('resolveIsOnline', () => {
  it('returns false when disconnected', () => {
    expect(resolveIsOnline({ isConnected: false, isInternetReachable: true })).toBe(false);
  });

  it('returns false when internet is explicitly unreachable', () => {
    expect(resolveIsOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
  });

  it('returns true when connected and reachability is unknown or true', () => {
    expect(resolveIsOnline({ isConnected: true, isInternetReachable: true })).toBe(true);
    expect(resolveIsOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
  });
});
