import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { isRevenueCatAvailable } from '@/lib/pro/revenueCat';

export async function getRevenueCatAppUserId(): Promise<string | null> {
  if (!isRevenueCatAvailable()) {
    return null;
  }
  try {
    return await Purchases.getAppUserID();
  } catch {
    return null;
  }
}

export function isNativePurchasePlatform(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}
