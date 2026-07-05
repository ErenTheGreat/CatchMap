import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client';

/** 30 min — spots don't change frequently; instant load from cache on launch */
export const STALE_TIME_MS = 30 * 60 * 1000;

/** 24 h — keep persisted cache on disk */
export const GC_TIME_MS = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      gcTime: GC_TIME_MS,
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: '@fishing_app_query_cache',
  throttleTime: 1000,
});

export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister: asyncStoragePersister,
  maxAge: GC_TIME_MS,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      const key = query.queryKey[0];
      return key === 'nearbyFishingSpots' || key === 'userLocation' || key === 'spotsBBox';
    },
  },
};
