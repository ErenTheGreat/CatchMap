import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@subscription_gate_complete';

export type SubscriptionGateStatus = 'loading' | 'pending' | 'complete';

interface SubscriptionGateContextValue {
  status: SubscriptionGateStatus;
  markComplete: () => void;
  reset: () => void;
}

const SubscriptionGateContext = createContext<SubscriptionGateContextValue | null>(null);

export function SubscriptionGateProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SubscriptionGateStatus>('loading');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => setStatus(stored === 'true' ? 'complete' : 'pending'))
      .catch(() => setStatus('pending'));
  }, []);

  const markComplete = useCallback(() => {
    setStatus('complete');
    AsyncStorage.setItem(STORAGE_KEY, 'true').catch(() => {});
  }, []);

  const reset = useCallback(() => {
    setStatus('pending');
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const value = useMemo(() => ({ status, markComplete, reset }), [status, markComplete, reset]);

  return (
    <SubscriptionGateContext.Provider value={value}>{children}</SubscriptionGateContext.Provider>
  );
}

export function useSubscriptionGate() {
  const context = useContext(SubscriptionGateContext);
  if (!context) {
    throw new Error('useSubscriptionGate must be used within SubscriptionGateProvider');
  }
  return context;
}
