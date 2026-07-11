import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  LOG_LEVEL,
} from 'react-native-purchases';
import { PRO_ENTITLEMENT_ID, PRO_MONTHLY_PRODUCT_ID, PRO_PRODUCT_ID } from '@/constants/pro';

let configured = false;

function getApiKey(): string | null {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.trim() || null;
  }
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?.trim() || null;
  }
  return null;
}

export function isRevenueCatAvailable(): boolean {
  return getApiKey() != null && Platform.OS !== 'web';
}

export async function configureRevenueCat(appUserId?: string | null): Promise<boolean> {
  const apiKey = getApiKey();
  if (!apiKey || Platform.OS === 'web') {
    return false;
  }
  if (configured) {
    if (appUserId) {
      try {
        await Purchases.logIn(appUserId);
      } catch {
        // Non-fatal — anonymous purchase still works
      }
    }
    return true;
  }

  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    Purchases.configure({ apiKey, appUserID: appUserId ?? undefined });
    configured = true;
    return true;
  } catch (error) {
    if (__DEV__) console.warn('[pro] RevenueCat configure failed:', error);
    return false;
  }
}

export function customerInfoHasPro(info: CustomerInfo): boolean {
  const active = info.entitlements.active[PRO_ENTITLEMENT_ID];
  return active != null && active.isActive;
}

export async function fetchProEntitlement(): Promise<boolean> {
  if (!isRevenueCatAvailable()) {
    return false;
  }
  try {
    const info = await Purchases.getCustomerInfo();
    return customerInfoHasPro(info);
  } catch (error) {
    if (__DEV__) console.warn('[pro] getCustomerInfo failed:', error);
    return false;
  }
}

async function getCurrentOffering() {
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
}

function findPackageByProductId(
  current: NonNullable<Awaited<ReturnType<typeof getCurrentOffering>>>,
  productId: string,
  packageType?: 'MONTHLY' | 'LIFETIME'
): PurchasesPackage | null {
  const byProduct = current.availablePackages.find(
    (pkg) => pkg.product.identifier === productId
  );
  if (byProduct) return byProduct;

  if (packageType === 'MONTHLY') {
    const monthly = current.monthly;
    if (monthly?.product.identifier === productId) {
      return monthly;
    }
    return monthly ?? null;
  }

  if (packageType === 'LIFETIME') {
    const lifetime = current.lifetime;
    if (lifetime?.product.identifier === productId) {
      return lifetime;
    }
    return lifetime ?? null;
  }

  return null;
}

export async function findProPackage(): Promise<PurchasesPackage | null> {
  if (!isRevenueCatAvailable()) {
    return null;
  }
  try {
    const current = await getCurrentOffering();
    if (!current) return null;

    const lifetime = findPackageByProductId(current, PRO_PRODUCT_ID, 'LIFETIME');
    if (lifetime) return lifetime;

    return current.availablePackages[0] ?? null;
  } catch (error) {
    if (__DEV__) console.warn('[pro] getOfferings failed:', error);
    return null;
  }
}

export async function findProMonthlyPackage(): Promise<PurchasesPackage | null> {
  if (!isRevenueCatAvailable()) {
    return null;
  }
  try {
    const current = await getCurrentOffering();
    if (!current) return null;

    return findPackageByProductId(current, PRO_MONTHLY_PRODUCT_ID, 'MONTHLY');
  } catch (error) {
    if (__DEV__) console.warn('[pro] getOfferings failed:', error);
    return null;
  }
}

export async function purchaseProPackage(
  pkg: PurchasesPackage
): Promise<{ entitled: boolean; error: string | null }> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { entitled: customerInfoHasPro(customerInfo), error: null };
  } catch (error: unknown) {
    const err = error as { userCancelled?: boolean; message?: string };
    if (err.userCancelled) {
      return { entitled: false, error: null };
    }
    return {
      entitled: false,
      error: err.message ?? 'Purchase could not be completed.',
    };
  }
}

export async function restoreProPurchases(): Promise<{
  entitled: boolean;
  error: string | null;
}> {
  if (!isRevenueCatAvailable()) {
    return { entitled: false, error: 'Purchases are not available on this platform.' };
  }
  try {
    const info = await Purchases.restorePurchases();
    return { entitled: customerInfoHasPro(info), error: null };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { entitled: false, error: err.message ?? 'Could not restore purchases.' };
  }
}

export async function getProPriceString(): Promise<string | null> {
  const pkg = await findProPackage();
  return pkg?.product.priceString ?? null;
}

export async function getProMonthlyPriceString(): Promise<string | null> {
  const pkg = await findProMonthlyPackage();
  return pkg?.product.priceString ?? null;
}
