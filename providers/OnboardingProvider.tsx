import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@onboarding_complete';

export type OnboardingStatus = 'loading' | 'pending' | 'complete';

interface OnboardingContextValue {
  status: OnboardingStatus;
  markComplete: () => void;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<OnboardingStatus>('loading');

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

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
