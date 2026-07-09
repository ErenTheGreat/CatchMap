import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { isSpeciesIdEnabled } from '@/constants/features';
import { generateVision } from '@/lib/ai/geminiClient';
import { hasUserGeminiApiKey } from '@/lib/ai/userApiKey';
import { matchSpeciesToCatalogDetailed } from '@/lib/species/matchSpeciesToCatalog';
import { getCatalogSpeciesNames } from '@/lib/ai/contextBuilder';

export interface SpeciesIdentificationResult {
  speciesName: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'gemini' | 'heuristic';
  provisional?: boolean;
}

export type SpeciesIdentificationFailure =
  | 'no_api_key'
  | 'quota_exceeded'
  | 'image_unreadable'
  | 'no_match'
  | 'server_unavailable'
  | 'aborted';

export interface SpeciesIdentificationResponse {
  result: SpeciesIdentificationResult | null;
  failure?: SpeciesIdentificationFailure;
  warning?: string;
}

function detectImageMimeType(uri: string, base64: string): string {
  if (uri.toLowerCase().includes('.png') || base64.startsWith('iVBOR')) {
    return 'image/png';
  }
  if (uri.toLowerCase().includes('.webp') || base64.startsWith('UklGR')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

async function blobToBase64(blob: Blob): Promise<string | null> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const output = reader.result;
      if (typeof output !== 'string') {
        resolve(null);
        return;
      }
      resolve(output.split(',')[1] ?? null);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function imageUriToBase64(uri: string): Promise<string | null> {
  try {
    if (uri.startsWith('data:')) {
      return uri.split(',')[1] ?? null;
    }

    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      return await blobToBase64(blob);
    }

    return await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  } catch (error) {
    if (__DEV__) console.warn('[speciesId] image base64 conversion failed:', error);
    return null;
  }
}

/**
 * Identifies fish species from a photo using the user's Gemini API key (BYOK).
 * No sign-in required. Falls back gracefully when no key is configured.
 */
export async function identifySpeciesFromPhoto(
  imageUri: string,
  signal?: AbortSignal
): Promise<SpeciesIdentificationResponse> {
  if (signal?.aborted || !isSpeciesIdEnabled() || !imageUri) {
    return { result: null };
  }

  const hasKey = await hasUserGeminiApiKey();
  if (!hasKey) {
    return {
      result: null,
      failure: 'no_api_key',
      warning: 'Add your free Google API key in Settings → Catch AI for photo identification.',
    };
  }

  const base64 = await imageUriToBase64(imageUri);
  if (!base64 || signal?.aborted) {
    return { result: null, failure: 'image_unreadable' };
  }

  const catalogNames = getCatalogSpeciesNames(60);
  const prompt = `You are CatchMap's fishing species assistant. Identify the fish species in this catch photo.
Prefer an exact match from this catalog when possible: ${catalogNames.join(', ')}.
If the fish is clearly a sport fish but not in the list, reply with its common English name.
If you cannot confidently identify the fish, reply UNKNOWN.
Reply with ONLY the species name — no punctuation, quotes, or extra words.`;

  try {
    const { result, error } = await generateVision({
      prompt,
      imageBase64: base64,
      mimeType: detectImageMimeType(imageUri, base64),
      signal,
    });

    if (signal?.aborted) {
      return { result: null, failure: 'aborted' };
    }

    if (error) {
      if (error.code === 'no_api_key') {
        return { result: null, failure: 'no_api_key', warning: error.message };
      }
      if (error.code === 'quota_exceeded') {
        return { result: null, failure: 'quota_exceeded', warning: error.message };
      }
      if (error.code === 'aborted') {
        return { result: null, failure: 'aborted' };
      }
      return { result: null, failure: 'server_unavailable', warning: error.message };
    }

    const raw = result?.text ?? '';
    const match = matchSpeciesToCatalogDetailed(raw);

    if (!match) {
      if (__DEV__) console.warn('[speciesId] no match for:', raw);
      return {
        result: null,
        failure: 'no_match',
        warning: 'Could not identify this fish — pick a species below or try a clearer photo.',
      };
    }

    return {
      result: {
        speciesName: match.name,
        confidence: match.provisional ? 'low' : 'medium',
        source: 'gemini',
        provisional: match.provisional,
      },
      warning: 'Uses 1 request from your Google free tier.',
    };
  } catch (error) {
    if (__DEV__) console.warn('Species identification failed:', error);
    return { result: null, failure: 'server_unavailable' };
  }
}
