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
  findProPackage,
  getProPriceString,
  isRevenueCatAvailable,
  purchaseProPackage,
  restoreProPurchases,
} from '@/lib/pro/revenueCat';
import { getProDisplayPrice } from '@/constants/pro';
import { useAuth } from '@/providers/AuthProvider';

const PRO_CACHE_KEY = '@catchmap_pro_entitled_v1';

interface ProContextValue {
  isPro: boolean;
  loading: boolean;
  priceLabel: string;
  storePriceLabel: string | null;
  purchasesAvailable: boolean;
  purchasePro: () => Promise<{ error: string | null; entitled: boolean }>;
  restorePurchases: () => Promise<{ entitled: boolean; error: string | null }>;
  refreshPro: () => Promise<void>;
}

const ProContext = createContext<ProContextValue | undefined>(undefined);

export function ProProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isPro, setIsPro] = useState(getProEntitled());
  const [loading, setLoading] = useState(true);
  const [storePriceLabel, setStorePriceLabel] = useState<string | null>(null);

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
      const storePrice = await getProPriceString();
      setStorePriceLabel(storePrice);
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

  const restorePurchases = useCallback(async () => {
    const result = await restoreProPurchases();
    if (result.entitled) {
      applyEntitlement(true);
      await AsyncStorage.setItem(PRO_CACHE_KEY, '1');
    }
    return result;
  }, [applyEntitlement]);

  const priceLabel = storePriceLabel ?? getProDisplayPrice();

  const value = useMemo<ProContextValue>(
    () => ({
      isPro,
      loading,
      priceLabel,
      storePriceLabel,
      purchasesAvailable: isRevenueCatAvailable(),
      purchasePro,
      restorePurchases,
      refreshPro,
    }),
    [isPro, loading, priceLabel, storePriceLabel, purchasePro, restorePurchases, refreshPro]
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
