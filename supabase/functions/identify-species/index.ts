/**
 * @deprecated Server-billed species ID is deprecated. CatchMap now uses BYOK (user's Gemini key)
 * from the mobile app. This endpoint returns 410 Gone.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: 'Server species ID is deprecated. Add your free Google API key in CatchMap Settings → Catch AI.',
      deprecated: true,
    }),
    {
      status: 410,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
});
