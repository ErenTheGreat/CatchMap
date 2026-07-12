import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const TILE_GRID_DEGREES = 0.25;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RADIUS_KM = 100;
const GBIF_LIMIT = 300;

const GBIF_SPORT_FISH_ORDER_KEYS = [587, 593, 630, 580, 445, 637];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnrichRequest {
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  waterType?: 'saltwater' | 'freshwater' | 'brackish';
}

interface GbifOccurrence {
  scientificName: string;
  vernacularName: string | null;
  speciesKey: number | null;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function snapToTileCenter(lat: number, lon: number): { lat: number; lon: number } {
  const snap = (value: number) =>
    Math.round(value / TILE_GRID_DEGREES) * TILE_GRID_DEGREES;
  return { lat: snap(lat), lon: snap(lon) };
}

function bboxAroundPoint(latitude: number, longitude: number, radiusKm: number): [number, number, number, number] {
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));
  return [
    longitude - lonDelta,
    latitude - latDelta,
    longitude + lonDelta,
    latitude + latDelta,
  ];
}

function inferWaterType(
  waterType: EnrichRequest['waterType'],
  latitude: number
): 'saltwater' | 'freshwater' | 'brackish' {
  if (waterType) return waterType;
  return Math.abs(latitude) < 35 ? 'saltwater' : 'freshwater';
}

function inferBiome(waterType: 'saltwater' | 'freshwater' | 'brackish'): string {
  if (waterType === 'saltwater') return 'coastal_saltwater';
  if (waterType === 'brackish') return 'brackish_bay';
  return 'freshwater_lake';
}

function parseOccurrence(raw: Record<string, unknown>): GbifOccurrence | null {
  const scientificName = raw.scientificName ?? raw.species;
  if (typeof scientificName !== 'string' || !scientificName.trim()) return null;
  return {
    scientificName: scientificName.trim(),
    vernacularName: typeof raw.vernacularName === 'string' ? raw.vernacularName : null,
    speciesKey: typeof raw.speciesKey === 'number' ? raw.speciesKey : null,
  };
}

async function fetchGbifForOrder(
  bbox: [number, number, number, number],
  orderKey: number
): Promise<GbifOccurrence[]> {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const url =
    `https://api.gbif.org/v1/occurrence/search?orderKey=${orderKey}` +
    `&decimalLatitude=${minLat},${maxLat}&decimalLongitude=${minLon},${maxLon}` +
    `&hasCoordinate=true&hasGeospatialIssue=false&limit=${Math.ceil(GBIF_LIMIT / GBIF_SPORT_FISH_ORDER_KEYS.length)}`;

  const response = await fetch(url);
  if (!response.ok) return [];

  const data = await response.json();
  const results: GbifOccurrence[] = [];
  for (const raw of data.results ?? []) {
    const parsed = parseOccurrence(raw as Record<string, unknown>);
    if (parsed) results.push(parsed);
  }
  return results;
}

function dedupeOccurrences(occurrences: GbifOccurrence[]): GbifOccurrence[] {
  const byKey = new Map<string, GbifOccurrence>();
  for (const item of occurrences) {
    const key = item.speciesKey != null ? String(item.speciesKey) : item.scientificName.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, item);
  }
  return Array.from(byKey.values());
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

  let body: EnrichRequest;
  try {
    body = (await req.json()) as EnrichRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const latitude = body.latitude;
  const longitude = body.longitude;
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return jsonResponse({ error: 'Valid latitude and longitude are required' }, 400);
  }

  const radiusKm = Math.min(
    typeof body.radiusKm === 'number' ? body.radiusKm : 50,
    MAX_RADIUS_KM
  );

  const tile = snapToTileCenter(latitude, longitude);
  const waterType = inferWaterType(body.waterType, tile.lat);
  const primaryBiome = inferBiome(waterType);
  const locationName = `Grid ${tile.lat.toFixed(2)},${tile.lon.toFixed(2)}`;

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: existingLocations, error: locLookupError } = await serviceClient
    .from('locations')
    .select('id, enriched_at')
    .eq('name', locationName)
    .limit(1);

  if (locLookupError) {
    console.error('Location lookup failed:', locLookupError.message);
    return jsonResponse({ error: 'Database lookup failed' }, 500);
  }

  let locationId = existingLocations?.[0]?.id ?? null;
  const enrichedAt = existingLocations?.[0]?.enriched_at ?? null;
  const cacheFresh =
    enrichedAt != null && Date.now() - new Date(enrichedAt).getTime() < CACHE_TTL_MS;

  if (!locationId || !cacheFresh) {
    const bbox = bboxAroundPoint(tile.lat, tile.lon, radiusKm);
    const orderResults = await Promise.all(
      GBIF_SPORT_FISH_ORDER_KEYS.map((orderKey) => fetchGbifForOrder(bbox, orderKey))
    );
    const occurrences = dedupeOccurrences(orderResults.flat()).slice(0, GBIF_LIMIT);

    if (!locationId) {
      const { data: insertedLoc, error: insertLocError } = await serviceClient
        .from('locations')
        .insert({
          name: locationName,
          water_type: waterType,
          coordinates: { type: 'Point', coordinates: [tile.lon, tile.lat] },
          enriched_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertLocError) {
        const { data: retryLoc } = await serviceClient
          .from('locations')
          .select('id')
          .eq('name', locationName)
          .limit(1)
          .maybeSingle();
        locationId = retryLoc?.id ?? null;
      } else {
        locationId = insertedLoc?.id ?? null;
      }
    } else {
      await serviceClient
        .from('locations')
        .update({ enriched_at: new Date().toISOString() })
        .eq('id', locationId);
    }

    if (locationId && occurrences.length > 0) {
      for (const occurrence of occurrences) {
        const displayName = occurrence.vernacularName?.trim() || occurrence.scientificName;

        const speciesRow: Record<string, unknown> = {
          name: displayName,
          scientific_name: occurrence.scientificName,
          primary_biome: primaryBiome,
        };
        if (occurrence.speciesKey != null) {
          speciesRow.gbif_taxon_key = occurrence.speciesKey;
        }

        const { data: upsertedSpecies, error: speciesError } = await serviceClient
          .from('species')
          .upsert(speciesRow, { onConflict: 'scientific_name', ignoreDuplicates: false })
          .select('id')
          .single();

        if (speciesError) {
          const { data: existingSpecies } = await serviceClient
            .from('species')
            .select('id')
            .eq('scientific_name', occurrence.scientificName)
            .maybeSingle();

          if (existingSpecies?.id) {
            await serviceClient.from('species_locations').upsert(
              {
                species_id: existingSpecies.id,
                location_id: locationId,
                data_source: 'GBIF',
              },
              { onConflict: 'species_id,location_id' }
            );
          }
          continue;
        }

        if (upsertedSpecies?.id) {
          await serviceClient.from('species_locations').upsert(
            {
              species_id: upsertedSpecies.id,
              location_id: locationId,
              data_source: 'GBIF',
            },
            { onConflict: 'species_id,location_id' }
          );
        }
      }
    }
  }

  const { data: speciesRows, error: speciesQueryError } = await serviceClient.rpc(
    'get_species_near_point',
    { p_latitude: tile.lat, p_longitude: tile.lon, p_radius_meters: radiusKm * 1000 }
  );

  if (speciesQueryError) {
    console.error('Species query failed:', speciesQueryError.message);
    return jsonResponse({ error: 'Failed to load species for region' }, 500);
  }

  const species = (speciesRows ?? []).map((row: Record<string, unknown>) => ({
    id: row.species_id,
    name: row.species_name,
    scientificName: row.scientific_name,
    primaryBiome: row.primary_biome,
    dataSource: row.data_source,
  }));

  return jsonResponse({
    locationId,
    species,
    cached: cacheFresh,
    fetchedAt: enrichedAt ?? new Date().toISOString(),
    tileCenter: tile,
  });
});
