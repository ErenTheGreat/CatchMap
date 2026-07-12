/*
# get_categorized_nearby_spots RPC

GPS-radius discovery query grouped into FishAngler-style categories for the
bottom-sheet Discovery Dashboard. Independent of map viewport bounds.

Requires: 20260705183000_003_fishing_engine_schema.sql (locations + PostGIS)
*/

CREATE OR REPLACE FUNCTION public.get_categorized_nearby_spots(
  p_latitude double precision,
  p_longitude double precision
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  WITH user_point AS (
    SELECT ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::extensions.geography AS geom
  ),
  nearby AS (
    SELECT
      l.id,
      l.name,
      l.water_type,
      ST_Y(l.coordinates::geometry) AS latitude,
      ST_X(l.coordinates::geometry) AS longitude,
      ST_Distance(l.coordinates, up.geom) / 1609.344 AS distance_miles,
      CASE
        WHEN l.water_type = 'saltwater'
          OR l.name ILIKE ANY (ARRAY['%bay%', '%ocean%', '%harbor%', '%harbour%', '%beach%', '%coast%'])
          THEN 'Bays & Oceans'
        WHEN l.name ILIKE ANY (ARRAY['%river%', '%creek%', '%stream%', '%run%'])
          THEN 'Rivers & Creeks'
        ELSE 'Lakes & Ponds'
      END AS category
    FROM public.locations l
    CROSS JOIN user_point up
    WHERE ST_DWithin(l.coordinates, up.geom, 80467.2) -- ~50 miles
    ORDER BY distance_miles ASC
    LIMIT 60
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'category', grouped.category,
        'spots', grouped.spots
      )
      ORDER BY grouped.sort_order
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT
      category,
      CASE category
        WHEN 'Lakes & Ponds' THEN 1
        WHEN 'Rivers & Creeks' THEN 2
        WHEN 'Bays & Oceans' THEN 3
        ELSE 99
      END AS sort_order,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'water_type', water_type,
          'latitude', latitude,
          'longitude', longitude,
          'distance_miles', ROUND(distance_miles::numeric, 1)
        )
        ORDER BY distance_miles ASC
      ) AS spots
    FROM nearby
    GROUP BY category
  ) grouped;
$$;

GRANT EXECUTE ON FUNCTION public.get_categorized_nearby_spots(
  double precision,
  double precision
) TO anon, authenticated;

COMMENT ON FUNCTION public.get_categorized_nearby_spots IS
  'GPS-radius categorized water bodies for the Discovery Dashboard bottom sheet.';
