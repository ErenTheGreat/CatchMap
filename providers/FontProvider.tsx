import React, { createContext, useContext, useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useAppFonts } from '@/hooks/useAppFonts';

interface FontContextValue {
  fontsReady: boolean;
}

const FontContext = createContext<FontContextValue>({ fontsReady: true });

export function FontProvider({ children }: { children: React.ReactNode }) {
  const { fontsLoaded } = useAppFonts();
  const fontsReady = fontsLoaded;

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsReady]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 2500);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <FontContext.Provider value={{ fontsReady }}>{children}</FontContext.Provider>
  );
}

export function useFontsReady() {
  return useContext(FontContext).fontsReady;
}
