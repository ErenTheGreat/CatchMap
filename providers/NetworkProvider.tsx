import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { getSafeNetInfo } from '@/lib/network/safeNetInfo';
import { resolveIsOnline, setupOnlineManager } from '@/lib/network/setupOnlineManager';

interface NetworkContextValue {
  isOnline: boolean;
  isOffline: boolean;
  isInternetReachable: boolean | null;
}

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  isOffline: false,
  isInternetReachable: true,
});

export function NetworkProvider({ children }: PropsWithChildren) {
  const [networkState, setNetworkState] = useState({
    isConnected: true,
    isInternetReachable: true as boolean | null,
  });

  useEffect(() => {
    setupOnlineManager();
    const netInfo = getSafeNetInfo();

    void netInfo.fetch().then((state) => {
      setNetworkState({
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable,
      });
    });

    return netInfo.addEventListener((state) => {
      setNetworkState({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
      });
    });
  }, []);

  const value = useMemo<NetworkContextValue>(() => {
    const isOnline = resolveIsOnline({
      isConnected: networkState.isConnected,
      isInternetReachable: networkState.isInternetReachable,
    });

    return {
      isOnline,
      isOffline: !isOnline,
      isInternetReachable: networkState.isInternetReachable,
    };
  }, [networkState.isConnected, networkState.isInternetReachable]);

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetworkStatus(): NetworkContextValue {
  return useContext(NetworkContext);
}
