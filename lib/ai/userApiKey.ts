import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SECURE_KEY = 'catchmap_gemini_api_key';
const ASYNC_KEY = 'catchmap_gemini_api_key_web';
const NATIVE_FALLBACK_KEY = 'catchmap_gemini_api_key_native';
const BUDGET_KEY = 'catchmap_ai_daily_budget';

const DEFAULT_DAILY_BUDGET = 100;
const MAX_DAILY_BUDGET = 500;

type SecureStoreModule = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

let secureStoreModule: SecureStoreModule | null | undefined;

/** Lazy-load SecureStore so the app still runs in dev clients built before expo-secure-store was added. */
function getSecureStore(): SecureStoreModule | null {
  if (secureStoreModule !== undefined) return secureStoreModule;
  if (Platform.OS === 'web') {
    secureStoreModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    secureStoreModule = require('expo-secure-store') as SecureStoreModule;
  } catch {
    secureStoreModule = null;
  }
  return secureStoreModule;
}

async function readNativeKey(): Promise<string | null> {
  const secureStore = getSecureStore();
  if (secureStore) {
    return (await secureStore.getItemAsync(SECURE_KEY))?.trim() || null;
  }
  return (await AsyncStorage.getItem(NATIVE_FALLBACK_KEY))?.trim() || null;
}

async function writeNativeKey(value: string): Promise<void> {
  const secureStore = getSecureStore();
  if (secureStore) {
    await secureStore.setItemAsync(SECURE_KEY, value);
    return;
  }
  await AsyncStorage.setItem(NATIVE_FALLBACK_KEY, value);
}

async function deleteNativeKey(): Promise<void> {
  const secureStore = getSecureStore();
  if (secureStore) {
    await secureStore.deleteItemAsync(SECURE_KEY);
  }
  await AsyncStorage.removeItem(NATIVE_FALLBACK_KEY);
}

export async function getUserGeminiApiKey(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return (await AsyncStorage.getItem(ASYNC_KEY))?.trim() || null;
    }
    return await readNativeKey();
  } catch {
    return null;
  }
}

export async function setUserGeminiApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) {
    await clearUserGeminiApiKey();
    return;
  }
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(ASYNC_KEY, trimmed);
    return;
  }
  await writeNativeKey(trimmed);
}

export async function clearUserGeminiApiKey(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(ASYNC_KEY);
      return true;
    }
    await deleteNativeKey();
    return true;
  } catch {
    return false;
  }
}

export async function hasUserGeminiApiKey(): Promise<boolean> {
  const key = await getUserGeminiApiKey();
  return !!key;
}

export async function getDailyBudget(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(BUDGET_KEY);
    const n = raw ? parseInt(raw, 10) : DEFAULT_DAILY_BUDGET;
    if (!Number.isFinite(n) || n < 1) return DEFAULT_DAILY_BUDGET;
    return Math.min(n, MAX_DAILY_BUDGET);
  } catch {
    return DEFAULT_DAILY_BUDGET;
  }
}

export async function setDailyBudget(budget: number): Promise<void> {
  const clamped = Math.max(1, Math.min(MAX_DAILY_BUDGET, Math.round(budget)));
  await AsyncStorage.setItem(BUDGET_KEY, String(clamped));
}

export { DEFAULT_DAILY_BUDGET, MAX_DAILY_BUDGET };
