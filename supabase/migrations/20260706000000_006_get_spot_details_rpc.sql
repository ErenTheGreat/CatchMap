/*
# get_spot_details RPC

Returns species documented at a fishing spot and aggregated best catch hours
from nearby catch_logs. Used by the map bottom sheet when a pin is selected.

Requires: 20260705183000_003_fishing_engine_schema.sql
*/

DROP FUNCTION IF EXISTS public.get_spot_details(double precision, double precision, uuid);

CREATE OR REPLACE FUNCTION public.get_spot_details(
  p_latitude double precision,
  p_longitude double precision,
  p_location_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_species jsonb;
  v_catch_times jsonb;
  v_point extensions.geography;
BEGIN
  v_point := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::extensions.geography;

  IF p_location_id IS NOT NULL THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'species_id', s.id,
          'species_name', s.name,
          'scientific_name', s.scientific_name,
          'primary_biome', s.primary_biome,
          'ideal_temp_min', s.ideal_temp_min,
          'ideal_temp_max', s.ideal_temp_max,
          'image_url', s.image_url,
          'data_source', sl.data_source
        )
        ORDER BY s.name ASC
      ),
      '[]'::jsonb
    )
    INTO v_species
    FROM public.species_locations sl
    JOIN public.species s ON s.id = sl.species_id
    WHERE sl.location_id = p_location_id;
  END IF;

  IF v_species IS NULL OR v_species = '[]'::jsonb THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'species_id', row.species_id,
          'species_name', row.species_name,
          'scientific_name', row.scientific_name,
          'primary_biome', row.primary_biome,
          'ideal_temp_min', row.ideal_temp_min,
          'ideal_temp_max', row.ideal_temp_max,
          'image_url', row.image_url,
          'data_source', row.data_source
        )
        ORDER BY row.species_name ASC
      ),
      '[]'::jsonb
    )
    INTO v_species
    FROM (
      SELECT DISTINCT ON (g.species_id)
        g.species_id,
        g.species_name,
        g.scientific_name,
        g.primary_biome,
        g.ideal_temp_min,
        g.ideal_temp_max,
        g.image_url,
        g.data_source
      FROM public.get_species_near_point(p_latitude, p_longitude, 500) AS g
      ORDER BY g.species_id, g.distance_meters ASC
    ) AS row;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'hour', agg.hour,
        'catch_count', agg.catch_count
      )
      ORDER BY agg.catch_count DESC, agg.hour ASC
    ),
    '[]'::jsonb
  )
  INTO v_catch_times
  FROM (
    SELECT
      EXTRACT(HOUR FROM cl.caught_at_timestamp AT TIME ZONE 'UTC')::integer AS hour,
      COUNT(*)::bigint AS catch_count
    FROM public.catch_logs cl
    WHERE ST_DWithin(cl.location, v_point, 1000)
      AND cl.caught_at_timestamp >= now() - interval '90 days'
    GROUP BY hour
    ORDER BY catch_count DESC, hour ASC
    LIMIT 5
  ) AS agg;

  RETURN jsonb_build_object(
    'species', COALESCE(v_species, '[]'::jsonb),
    'best_catch_times', COALESCE(v_catch_times, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_spot_details(
  double precision,
  double precision,
  uuid
) TO anon, authenticated;

COMMENT ON FUNCTION public.get_spot_details IS
  'Spot detail payload for map pin selection — species at location (or nearby) plus top catch hours from anonymized catch_logs aggregates.';
