import { getUserGeminiApiKey } from '@/lib/ai/userApiKey';
import { canMakeAiRequest, incrementUsageCount } from '@/lib/ai/usageTracker';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export type GeminiErrorCode =
  | 'no_api_key'
  | 'quota_exceeded'
  | 'api_error'
  | 'empty_response'
  | 'aborted';

export interface GeminiTextOptions {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  skipUsageIncrement?: boolean;
}

export interface GeminiVisionOptions {
  prompt: string;
  imageBase64: string;
  mimeType?: string;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  skipUsageIncrement?: boolean;
}

export interface GeminiResult {
  text: string;
}

export interface GeminiError {
  code: GeminiErrorCode;
  message: string;
}

function buildContents(
  systemPrompt: string | undefined,
  userParts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }>
) {
  const contents: Array<{ role: string; parts: typeof userParts }> = [];
  if (systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
    contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
  }
  contents.push({ role: 'user', parts: userParts });
  return contents;
}

async function callGemini(
  apiKey: string,
  body: Record<string, unknown>,
  signal?: AbortSignal
): Promise<{ ok: true; text: string } | { ok: false; code: GeminiErrorCode; message: string }> {
  const response = await fetch(
    `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 429) {
      return { ok: false, code: 'api_error', message: 'Google API rate limit reached. Try again later.' };
    }
    if (response.status === 400 && detail.includes('API_KEY')) {
      return { ok: false, code: 'no_api_key', message: 'Invalid API key. Check Settings → Catch AI.' };
    }
    return { ok: false, code: 'api_error', message: `Gemini request failed (${response.status})` };
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  if (!text) {
    return { ok: false, code: 'empty_response', message: 'No response from Gemini.' };
  }
  return { ok: true, text };
}

export async function generateText(
  options: GeminiTextOptions
): Promise<{ result: GeminiResult | null; error: GeminiError | null }> {
  if (options.signal?.aborted) {
    return { result: null, error: { code: 'aborted', message: 'Request cancelled.' } };
  }

  const apiKey = await getUserGeminiApiKey();
  if (!apiKey) {
    return {
      result: null,
      error: {
        code: 'no_api_key',
        message: 'Add your free Google API key in Settings → Catch AI.',
      },
    };
  }

  if (!(await canMakeAiRequest())) {
    return {
      result: null,
      error: {
        code: 'quota_exceeded',
        message: 'Daily AI budget reached. Adjust in Settings or try tomorrow.',
      },
    };
  }

  const contents = buildContents(options.systemPrompt, [{ text: options.userPrompt }]);
  const response = await callGemini(
    apiKey,
    {
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxOutputTokens ?? 1024,
        thinkingConfig: { thinkingBudget: 0 },
      },
      contents,
    },
    options.signal
  );

  if (!response.ok) {
    return { result: null, error: { code: response.code, message: response.message } };
  }

  if (!options.skipUsageIncrement) {
    await incrementUsageCount(1);
  }

  return { result: { text: response.text }, error: null };
}

export async function generateVision(
  options: GeminiVisionOptions
): Promise<{ result: GeminiResult | null; error: GeminiError | null }> {
  if (options.signal?.aborted) {
    return { result: null, error: { code: 'aborted', message: 'Request cancelled.' } };
  }

  const apiKey = await getUserGeminiApiKey();
  if (!apiKey) {
    return {
      result: null,
      error: {
        code: 'no_api_key',
        message: 'Add your free Google API key in Settings → Catch AI for photo ID.',
      },
    };
  }

  if (!(await canMakeAiRequest())) {
    return {
      result: null,
      error: {
        code: 'quota_exceeded',
        message: 'Daily AI budget reached. Pick species manually or try tomorrow.',
      },
    };
  }

  const contents = buildContents(undefined, [
    { text: options.prompt },
    {
      inline_data: {
        mime_type: options.mimeType ?? 'image/jpeg',
        data: options.imageBase64,
      },
    },
  ]);

  const response = await callGemini(
    apiKey,
    {
      generationConfig: {
        temperature: options.temperature ?? 0.1,
        maxOutputTokens: options.maxOutputTokens ?? 256,
        thinkingConfig: { thinkingBudget: 0 },
      },
      contents,
    },
    options.signal
  );

  if (!response.ok) {
    return { result: null, error: { code: response.code, message: response.message } };
  }

  if (!options.skipUsageIncrement) {
    await incrementUsageCount(1);
  }

  return { result: { text: response.text }, error: null };
}

export async function testGeminiConnection(apiKey: string): Promise<boolean> {
  const response = await callGemini(apiKey, {
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 16,
      thinkingConfig: { thinkingBudget: 0 },
    },
    contents: [{ role: 'user', parts: [{ text: 'Reply OK' }] }],
  });
  return response.ok;
}
