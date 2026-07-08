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
      networkMode: 'offlineFirst',
    },
  },
});

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  // v4: persist species + weather for offline spot detail
  key: '@fishing_app_query_cache_v4',
  throttleTime: 1000,
});

const NON_PERSISTED_QUERY_KEYS = new Set([
  'spotsBBox',
  'spotDetails',
  'localSpecies',
  'categorizedSpots',
  'catchActivity',
]);

const PERSISTED_QUERY_KEYS = new Set([
  'nearbyFishingSpots',
  'userLocation',
  'speciesAvailability',
  'weather',
]);

export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister: asyncStoragePersister,
  maxAge: GC_TIME_MS,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      const key = query.queryKey[0];
      if (typeof key === 'string' && NON_PERSISTED_QUERY_KEYS.has(key)) {
        return false;
      }
      if (typeof key === 'string' && PERSISTED_QUERY_KEYS.has(key)) {
        return query.state.status === 'success';
      }
      return false;
    },
  },
};
