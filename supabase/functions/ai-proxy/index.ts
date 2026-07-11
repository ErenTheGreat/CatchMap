import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DAILY_AI_LIMIT = 30;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AiProxyRequest {
  mode?: 'text' | 'vision' | 'usage';
  revenueCatAppUserId?: string;
  feature?: string;
  systemPrompt?: string;
  userPrompt?: string;
  prompt?: string;
  imageBase64?: string;
  mimeType?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function hashIdentifier(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyRevenueCatPro(appUserId: string): Promise<boolean> {
  const apiKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  if (!apiKey || !appUserId) return false;

  try {
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (!response.ok) return false;
    const payload = (await response.json()) as {
      subscriber?: { entitlements?: Record<string, { expires_date?: string | null }> };
    };
    const pro = payload.subscriber?.entitlements?.pro;
    if (!pro) return false;
    if (!pro.expires_date) return true;
    return new Date(pro.expires_date) > new Date();
  } catch {
    return false;
  }
}

async function resolveUserKey(
  supabase: ReturnType<typeof createClient>,
  authHeader: string | null,
  revenueCatAppUserId?: string
): Promise<{ userId: string | null; identifier: string; entitled: boolean }> {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  let userId: string | null = null;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const { data } = await supabase.auth.getUser(token);
    userId = data.user?.id ?? null;
  }

  const identifier = userId ?? (authHeader ? await hashIdentifier(authHeader) : 'anonymous');

  if (userId) {
    const { data: row } = await admin
      .from('pro_entitlements')
      .select('is_active, expires_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (row?.is_active) {
      if (!row.expires_at || new Date(row.expires_at) > new Date()) {
        return { userId, identifier: userId, entitled: true };
      }
    }
  }

  if (revenueCatAppUserId && (await verifyRevenueCatPro(revenueCatAppUserId))) {
    return { userId, identifier: revenueCatAppUserId, entitled: true };
  }

  // Dev / staging bypass when GEMINI is set and PRO_DEV_BYPASS=true
  if (Deno.env.get('PRO_DEV_BYPASS') === 'true') {
    return { userId, identifier, entitled: true };
  }

  return { userId, identifier, entitled: false };
}

async function getUsage(
  admin: ReturnType<typeof createClient>,
  identifier: string
): Promise<{ count: number; limit: number; remaining: number }> {
  const day = todayKey();
  const { data } = await admin
    .from('pro_ai_usage')
    .select('request_count')
    .eq('user_identifier', identifier)
    .eq('usage_date', day)
    .maybeSingle();

  const count = data?.request_count ?? 0;
  return {
    count,
    limit: DAILY_AI_LIMIT,
    remaining: Math.max(0, DAILY_AI_LIMIT - count),
  };
}

async function incrementUsage(
  admin: ReturnType<typeof createClient>,
  identifier: string,
  userId: string | null
): Promise<number> {
  const day = todayKey();
  const { data: existing } = await admin
    .from('pro_ai_usage')
    .select('request_count')
    .eq('user_identifier', identifier)
    .eq('usage_date', day)
    .maybeSingle();

  const nextCount = (existing?.request_count ?? 0) + 1;

  await admin.from('pro_ai_usage').upsert(
    {
      user_identifier: identifier,
      user_id: userId,
      usage_date: day,
      request_count: nextCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_identifier,usage_date' }
  );

  return nextCount;
}

function buildGeminiBody(
  mode: 'text' | 'vision',
  body: AiProxyRequest
): Record<string, unknown> {
  const generationConfig = {
    temperature: body.temperature ?? 0.7,
    maxOutputTokens: body.maxOutputTokens ?? 1024,
  };

  if (mode === 'vision') {
    const parts = [
      { text: body.prompt ?? 'Identify the fish species.' },
      {
        inline_data: {
          mime_type: body.mimeType ?? 'image/jpeg',
          data: body.imageBase64 ?? '',
        },
      },
    ];
    return {
      contents: [{ role: 'user', parts }],
      generationConfig,
    };
  }

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  if (body.systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: body.systemPrompt }] });
    contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
  }
  contents.push({ role: 'user', parts: [{ text: body.userPrompt ?? '' }] });

  return { contents, generationConfig };
}

async function callGemini(body: Record<string, unknown>): Promise<string | null> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const response = await fetch(
    `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini error ${response.status}: ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization');

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
  });
  const admin = createClient(supabaseUrl, serviceKey);

  let body: AiProxyRequest;
  try {
    body = (await req.json()) as AiProxyRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body', code: 'api_error' }, 400);
  }

  const { userId, identifier, entitled } = await resolveUserKey(
    supabase,
    authHeader,
    body.revenueCatAppUserId
  );

  if (body.mode === 'usage') {
    if (!entitled) {
      return jsonResponse({
        usage: { count: 0, limit: DAILY_AI_LIMIT, remaining: 0 },
        entitled: false,
      });
    }
    const usage = await getUsage(admin, identifier);
    return jsonResponse({ usage, entitled: true });
  }

  if (!entitled) {
    return jsonResponse(
      {
        error: 'CatchMap Pro is required for hosted AI. Upgrade in the app.',
        code: 'not_pro',
      },
      403
    );
  }

  const usage = await getUsage(admin, identifier);
  if (usage.remaining <= 0) {
    return jsonResponse(
      {
        error: `Daily AI limit reached (${DAILY_AI_LIMIT} requests). Try again tomorrow.`,
        code: 'quota_exceeded',
        usage,
      },
      429
    );
  }

  const mode = body.mode === 'vision' ? 'vision' : 'text';

  try {
    const geminiBody = buildGeminiBody(mode, body);
    const text = await callGemini(geminiBody);
    if (!text) {
      return jsonResponse({ error: 'Empty AI response', code: 'empty_response' }, 502);
    }

    const count = await incrementUsage(admin, identifier, userId);
    const nextUsage = {
      count,
      limit: DAILY_AI_LIMIT,
      remaining: Math.max(0, DAILY_AI_LIMIT - count),
    };

    return jsonResponse({ text, usage: nextUsage, feature: body.feature ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI request failed';
    return jsonResponse({ error: message, code: 'api_error' }, 500);
  }
});
