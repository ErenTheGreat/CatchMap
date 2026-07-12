/*
# Fix search_fishing_spots RPC

The deployed function was returning SETOF locations (raw geography WKB) instead of
decoded latitude/longitude, so the mobile search bar filtered out every match.

Recreates the RPC from migration 004 with explicit lat/lng columns and pg_trgm-friendly
name matching.
*/

DROP FUNCTION IF EXISTS public.search_fishing_spots(text);

CREATE OR REPLACE FUNCTION public.search_fishing_spots(search_term text)
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
  WHERE l.name ILIKE '%' || trim(search_term) || '%'
  ORDER BY l.name ASC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.search_fishing_spots(text) TO anon, authenticated;

COMMENT ON FUNCTION public.search_fishing_spots IS
  'Partial, case-insensitive location search returning decoded WGS84 coordinates.';
