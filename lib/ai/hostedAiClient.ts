import { supabase } from '@/lib/supabase';
import { PRO_AI_DAILY_LIMIT } from '@/constants/pro';
import { getRevenueCatAppUserId } from '@/lib/pro/revenueCatUser';

export type HostedAiFeature = 'chat' | 'species_id' | 'coach_enhance' | 'trip_brief' | 'fish_today';

export type HostedAiErrorCode =
  | 'not_pro'
  | 'quota_exceeded'
  | 'auth_required'
  | 'api_error'
  | 'empty_response'
  | 'aborted';

export interface HostedAiError {
  code: HostedAiErrorCode;
  message: string;
}

export interface HostedAiUsage {
  count: number;
  limit: number;
  remaining: number;
}

export interface HostedTextRequest {
  feature: HostedAiFeature;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export interface HostedVisionRequest {
  feature: 'species_id';
  prompt: string;
  imageBase64: string;
  mimeType?: string;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function callAiProxy(body: Record<string, unknown>, signal?: AbortSignal) {
  const [token, revenueCatAppUserId] = await Promise.all([
    getAccessToken(),
    getRevenueCatAppUserId(),
  ]);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!baseUrl) {
    return {
      ok: false as const,
      code: 'api_error' as const,
      message: 'Supabase is not configured.',
    };
  }

  const response = await fetch(`${baseUrl}/functions/v1/ai-proxy`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...body,
      revenueCatAppUserId: revenueCatAppUserId ?? undefined,
    }),
    signal,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    text?: string;
    error?: string;
    code?: HostedAiErrorCode;
    usage?: HostedAiUsage;
  };

  if (!response.ok) {
    return {
      ok: false as const,
      code: (payload.code ?? 'api_error') as HostedAiErrorCode,
      message: payload.error ?? `AI request failed (${response.status})`,
      usage: payload.usage,
    };
  }

  const text = payload.text?.trim() ?? '';
  if (!text) {
    return {
      ok: false as const,
      code: 'empty_response' as const,
      message: 'No response from Catch AI.',
      usage: payload.usage,
    };
  }

  return { ok: true as const, text, usage: payload.usage };
}

export async function hostedGenerateText(
  request: HostedTextRequest
): Promise<{ text: string | null; error: HostedAiError | null; usage?: HostedAiUsage }> {
  if (request.signal?.aborted) {
    return { text: null, error: { code: 'aborted', message: 'Request cancelled.' } };
  }

  const result = await callAiProxy(
    {
      mode: 'text',
      feature: request.feature,
      systemPrompt: request.systemPrompt,
      userPrompt: request.userPrompt,
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
    },
    request.signal
  );

  if (!result.ok) {
    return {
      text: null,
      error: { code: result.code, message: result.message },
      usage: result.usage,
    };
  }

  return { text: result.text, error: null, usage: result.usage };
}

export async function hostedGenerateVision(
  request: HostedVisionRequest
): Promise<{ text: string | null; error: HostedAiError | null; usage?: HostedAiUsage }> {
  if (request.signal?.aborted) {
    return { text: null, error: { code: 'aborted', message: 'Request cancelled.' } };
  }

  const result = await callAiProxy(
    {
      mode: 'vision',
      feature: request.feature,
      prompt: request.prompt,
      imageBase64: request.imageBase64,
      mimeType: request.mimeType ?? 'image/jpeg',
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
    },
    request.signal
  );

  if (!result.ok) {
    return {
      text: null,
      error: { code: result.code, message: result.message },
      usage: result.usage,
    };
  }

  return { text: result.text, error: null, usage: result.usage };
}

export async function fetchHostedAiUsage(): Promise<HostedAiUsage> {
  const token = await getAccessToken();
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!baseUrl) {
    return { count: 0, limit: PRO_AI_DAILY_LIMIT, remaining: PRO_AI_DAILY_LIMIT };
  }

  try {
    const response = await fetch(`${baseUrl}/functions/v1/ai-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ mode: 'usage' }),
    });
    const payload = (await response.json()) as { usage?: HostedAiUsage };
    return (
      payload.usage ?? {
        count: 0,
        limit: PRO_AI_DAILY_LIMIT,
        remaining: PRO_AI_DAILY_LIMIT,
      }
    );
  } catch {
    return { count: 0, limit: PRO_AI_DAILY_LIMIT, remaining: PRO_AI_DAILY_LIMIT };
  }
}
