/*
# get_locations_in_bbox RPC

Returns PostGIS locations whose coordinates fall inside the map viewport
envelope. Used by the mobile map to render pins globally as the camera moves.

Requires: 20260705183000_003_fishing_engine_schema.sql (locations table + PostGIS)
*/

DROP FUNCTION IF EXISTS public.get_locations_in_bbox(
  double precision,
  double precision,
  double precision,
  double precision
);

CREATE OR REPLACE FUNCTION public.get_locations_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
RETURNS TABLE (
  id uuid,
  name text,
  water_type public.water_type_enum,
  latitude double precision,
  longitude double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT
    l.id,
    l.name,
    l.water_type,
    ST_Y(l.coordinates::geometry) AS latitude,
    ST_X(l.coordinates::geometry) AS longitude
  FROM public.locations l
  WHERE ST_Intersects(
    l.coordinates::geometry,
    ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  )
  ORDER BY l.name ASC
  LIMIT 300;
$$;

GRANT EXECUTE ON FUNCTION public.get_locations_in_bbox(
  double precision,
  double precision,
  double precision,
  double precision
) TO anon, authenticated;

COMMENT ON FUNCTION public.get_locations_in_bbox IS
  'Viewport envelope query for map pins — returns WGS84 coordinates inside the bbox.';
