import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DarkColors,
  LightColors,
  OutdoorColors,
  type ThemeColors,
} from '@/constants/theme';

export type ThemePreference = 'system' | 'light' | 'dark' | 'outdoor';

const STORAGE_KEY = '@theme_preference';

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  isOutdoor: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  cyclePreference: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const PREFERENCE_ORDER: ThemePreference[] = ['system', 'light', 'dark', 'outdoor'];

function resolveIsDark(preference: ThemePreference, systemScheme: 'light' | 'dark' | null | undefined) {
  if (preference === 'dark') return true;
  if (preference === 'light' || preference === 'outdoor') return false;
  return systemScheme === 'dark';
}

function resolveColors(
  preference: ThemePreference,
  systemScheme: 'light' | 'dark' | null | undefined
): ThemeColors {
  if (preference === 'outdoor') return OutdoorColors;
  return resolveIsDark(preference, systemScheme) ? DarkColors : LightColors;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (
        stored === 'light' ||
        stored === 'dark' ||
        stored === 'system' ||
        stored === 'outdoor'
      ) {
        setPreferenceState(stored);
      }
    });
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const cyclePreference = useCallback(() => {
    setPreferenceState((current) => {
      const index = PREFERENCE_ORDER.indexOf(current);
      const next = PREFERENCE_ORDER[(index + 1) % PREFERENCE_ORDER.length];
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const isOutdoor = preference === 'outdoor';
  const isDark = !isOutdoor && resolveIsDark(preference, systemScheme);
  const colors = resolveColors(preference, systemScheme);

  const value = useMemo(
    () => ({
      colors,
      isDark,
      isOutdoor,
      preference,
      setPreference,
      cyclePreference,
    }),
    [colors, isDark, isOutdoor, preference, setPreference, cyclePreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
