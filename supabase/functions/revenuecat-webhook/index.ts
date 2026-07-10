import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LIFETIME_PRODUCT_ID = 'catchmap_pro_lifetime';

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function parseExpirationAt(event: Record<string, unknown>): string | null {
  const expirationMs = event.expiration_at_ms;
  if (typeof expirationMs === 'number' && Number.isFinite(expirationMs) && expirationMs > 0) {
    return new Date(expirationMs).toISOString();
  }
  return null;
}

function isLifetimeProduct(productId: string): boolean {
  return productId === LIFETIME_PRODUCT_ID;
}

/**
 * RevenueCat webhook — syncs pro_entitlements for subscriptions and lifetime purchases.
 * Configure in RevenueCat: POST https://<project>.supabase.co/functions/v1/revenuecat-webhook
 * Set REVENUECAT_WEBHOOK_SECRET and verify Authorization header if configured.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (webhookSecret) {
    const auth = req.headers.get('Authorization');
    if (auth !== `Bearer ${webhookSecret}`) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const event = payload.event as Record<string, unknown> | undefined;
  if (!event) {
    return jsonResponse({ ok: true, skipped: 'no event' });
  }

  const eventType = String(event.type ?? '');
  const appUserId = String(event.app_user_id ?? '');
  const productId = String((event.product_id as string | undefined) ?? 'catchmap_pro_monthly');

  if (!appUserId) {
    return jsonResponse({ ok: true, skipped: 'no_app_user_id' });
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(appUserId)) {
    return jsonResponse({ ok: true, skipped: 'anonymous_app_user_id' });
  }

  const grantEvents = new Set([
    'INITIAL_PURCHASE',
    'NON_RENEWING_PURCHASE',
    'RENEWAL',
    'UNCANCELLATION',
    'RESTORE',
    'PRODUCT_CHANGE',
  ]);

  const revokeEvents = new Set(['EXPIRATION']);

  if (!grantEvents.has(eventType) && !revokeEvents.has(eventType)) {
    return jsonResponse({ ok: true, skipped: eventType });
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  if (revokeEvents.has(eventType)) {
    const { error } = await admin.rpc('revoke_pro_entitlement', {
      p_user_id: appUserId,
    });

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ ok: true, revoked: appUserId });
  }

  const expiresAt = isLifetimeProduct(productId) ? null : parseExpirationAt(event);

  const { error } = await admin.rpc('grant_pro_entitlement', {
    p_user_id: appUserId,
    p_product_id: productId,
    p_revenuecat_customer_id: String(event.original_app_user_id ?? appUserId),
    p_expires_at: expiresAt,
  });

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({ ok: true, granted: appUserId, expires_at: expiresAt });
});
