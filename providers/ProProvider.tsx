import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setProEntitled, getProEntitled } from '@/lib/pro/proState';
import {
  configureRevenueCat,
  fetchProEntitlement,
  findProMonthlyPackage,
  findProPackage,
  getProMonthlyPriceString,
  getProPriceString,
  isRevenueCatAvailable,
  purchaseProPackage,
  restoreProPurchases,
} from '@/lib/pro/revenueCat';
import { getProDisplayPrice, getProMonthlyDisplayPrice } from '@/constants/pro';
import { useAuth } from '@/providers/AuthProvider';

const PRO_CACHE_KEY = '@catchmap_pro_entitled_v1';

interface ProContextValue {
  isPro: boolean;
  loading: boolean;
  priceLabel: string;
  monthlyPriceLabel: string;
  storePriceLabel: string | null;
  storeMonthlyPriceLabel: string | null;
  purchasesAvailable: boolean;
  purchasePro: () => Promise<{ error: string | null; entitled: boolean }>;
  purchaseProMonthly: () => Promise<{ error: string | null; entitled: boolean }>;
  restorePurchases: () => Promise<{ entitled: boolean; error: string | null }>;
  refreshPro: () => Promise<void>;
}

const ProContext = createContext<ProContextValue | undefined>(undefined);

export function ProProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isPro, setIsPro] = useState(getProEntitled());
  const [loading, setLoading] = useState(true);
  const [storePriceLabel, setStorePriceLabel] = useState<string | null>(null);
  const [storeMonthlyPriceLabel, setStoreMonthlyPriceLabel] = useState<string | null>(null);

  const applyEntitlement = useCallback((entitled: boolean) => {
    setProEntitled(entitled);
    setIsPro(entitled);
  }, []);

  const refreshPro = useCallback(async () => {
    if (process.env.EXPO_PUBLIC_PRO_DEV_UNLOCK === 'true') {
      applyEntitlement(true);
      return;
    }

    if (isRevenueCatAvailable()) {
      await configureRevenueCat(user?.id ?? null);
      const entitled = await fetchProEntitlement();
      applyEntitlement(entitled);
      await AsyncStorage.setItem(PRO_CACHE_KEY, entitled ? '1' : '0');
      const [storePrice, storeMonthlyPrice] = await Promise.all([
        getProPriceString(),
        getProMonthlyPriceString(),
      ]);
      setStorePriceLabel(storePrice);
      setStoreMonthlyPriceLabel(storeMonthlyPrice);
      return;
    }

    try {
      const cached = await AsyncStorage.getItem(PRO_CACHE_KEY);
      applyEntitlement(cached === '1');
    } catch {
      applyEntitlement(false);
    }
  }, [applyEntitlement, user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refreshPro();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshPro]);

  const purchasePro = useCallback(async (): Promise<{ error: string | null; entitled: boolean }> => {
    if (Platform.OS === 'web') {
      return { error: 'Upgrade on the CatchMap mobile app to unlock Pro.', entitled: false };
    }
    if (!isRevenueCatAvailable()) {
      return {
        error:
          'In-app purchases are not configured yet. Set RevenueCat API keys in your build environment.',
        entitled: false,
      };
    }

    await configureRevenueCat(user?.id ?? null);
    const pkg = await findProPackage();
    if (!pkg) {
      return { error: 'Pro is not available in the store right now. Try again later.', entitled: false };
    }

    const { entitled, error } = await purchaseProPackage(pkg);
    if (entitled) {
      applyEntitlement(true);
      await AsyncStorage.setItem(PRO_CACHE_KEY, '1');
    }
    return { error, entitled };
  }, [applyEntitlement, user?.id]);

  const purchaseProMonthly = useCallback(async (): Promise<{ error: string | null; entitled: boolean }> => {
    if (Platform.OS === 'web') {
      return { error: 'Subscribe on the CatchMap mobile app to unlock Pro.', entitled: false };
    }
    if (!isRevenueCatAvailable()) {
      return {
        error:
          'In-app purchases are not configured yet. Set RevenueCat API keys in your build environment.',
        entitled: false,
      };
    }

    await configureRevenueCat(user?.id ?? null);
    const pkg = await findProMonthlyPackage();
    if (!pkg) {
      return {
        error: 'Pro monthly is not available in the store right now. Try again later.',
        entitled: false,
      };
    }

    const { entitled, error } = await purchaseProPackage(pkg);
    if (entitled) {
      applyEntitlement(true);
      await AsyncStorage.setItem(PRO_CACHE_KEY, '1');
    }
    return { error, entitled };
  }, [applyEntitlement, user?.id]);

  const restorePurchases = useCallback(async () => {
    const result = await restoreProPurchases();
    if (result.entitled) {
      applyEntitlement(true);
      await AsyncStorage.setItem(PRO_CACHE_KEY, '1');
    }
    return result;
  }, [applyEntitlement]);

  const priceLabel = storePriceLabel ?? getProDisplayPrice();
  const monthlyPriceLabel = storeMonthlyPriceLabel ?? getProMonthlyDisplayPrice();

  const value = useMemo<ProContextValue>(
    () => ({
      isPro,
      loading,
      priceLabel,
      monthlyPriceLabel,
      storePriceLabel,
      storeMonthlyPriceLabel,
      purchasesAvailable: isRevenueCatAvailable(),
      purchasePro,
      purchaseProMonthly,
      restorePurchases,
      refreshPro,
    }),
    [
      isPro,
      loading,
      priceLabel,
      monthlyPriceLabel,
      storePriceLabel,
      storeMonthlyPriceLabel,
      purchasePro,
      purchaseProMonthly,
      restorePurchases,
      refreshPro,
    ]
  );

  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

export function usePro(): ProContextValue {
  const ctx = useContext(ProContext);
  if (!ctx) {
    throw new Error('usePro must be used within ProProvider');
  }
  return ctx;
}

/** Safe hook for components that may render outside ProProvider during tests. */
export function useProOptional(): ProContextValue | null {
  return useContext(ProContext) ?? null;
}
