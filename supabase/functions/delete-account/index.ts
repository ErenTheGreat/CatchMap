import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PHOTOS_BUCKET = 'catch-photos';

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

async function deleteUserStorage(
  serviceClient: ReturnType<typeof createClient>,
  userId: string
): Promise<void> {
  const prefix = `${userId}/`;
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await serviceClient.storage.from(PHOTOS_BUCKET).list(userId, {
      limit,
      offset,
    });

    if (error) {
      console.error('Storage list failed:', error.message);
      break;
    }

    if (!data?.length) break;

    const paths = data.map((item) => `${prefix}${item.name}`);
    const { error: removeError } = await serviceClient.storage.from(PHOTOS_BUCKET).remove(paths);
    if (removeError) {
      console.error('Storage remove failed:', removeError.message);
    }

    if (data.length < limit) break;
    offset += limit;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Server configuration error' }, 503);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ error: 'Invalid or expired session' }, 401);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const userId = user.id;

  const { error: catchLogsError } = await serviceClient
    .from('catch_logs')
    .delete()
    .eq('user_id', userId);

  if (catchLogsError) {
    console.error('catch_logs delete failed:', catchLogsError.message);
    return jsonResponse({ error: 'Could not delete catch data' }, 500);
  }

  const { error: waypointsError } = await serviceClient
    .from('waypoints')
    .delete()
    .eq('user_id', userId);

  if (waypointsError) {
    console.error('waypoints delete failed:', waypointsError.message);
    return jsonResponse({ error: 'Could not delete waypoint data' }, 500);
  }

  const { error: usageError } = await serviceClient
    .from('species_id_usage')
    .delete()
    .eq('user_id', userId);

  if (usageError) {
    console.error('species_id_usage delete failed:', usageError.message);
  }

  await deleteUserStorage(serviceClient, userId);

  const { error: deleteUserError } = await serviceClient.auth.admin.deleteUser(userId);

  if (deleteUserError) {
    console.error('auth delete failed:', deleteUserError.message);
    return jsonResponse({ error: 'Could not delete account' }, 500);
  }

  return jsonResponse({ success: true });
});
