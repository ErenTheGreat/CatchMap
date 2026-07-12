/*
# get_categorized_spots_in_bbox RPC

Viewport-envelope discovery query grouped into FishAngler-style categories for
the Global Explorer bottom-sheet dashboard.

Requires: 20260705183000_003_fishing_engine_schema.sql (locations + PostGIS)
*/

CREATE OR REPLACE FUNCTION public.get_categorized_spots_in_bbox(
  p_min_lat double precision,
  p_max_lat double precision,
  p_min_lng double precision,
  p_max_lng double precision
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  WITH in_view AS (
    SELECT
      l.id,
      l.name,
      l.water_type,
      ST_Y(l.coordinates::geometry) AS latitude,
      ST_X(l.coordinates::geometry) AS longitude,
      CASE
        WHEN l.water_type = 'saltwater'
          OR l.name ILIKE ANY (ARRAY['%bay%', '%ocean%', '%harbor%', '%harbour%', '%beach%', '%coast%'])
          THEN 'Bays & Oceans'
        WHEN l.name ILIKE ANY (ARRAY['%river%', '%creek%', '%stream%', '%run%'])
          THEN 'Rivers & Creeks'
        ELSE 'Lakes & Ponds'
      END AS category
    FROM public.locations l
    WHERE ST_Intersects(
      l.coordinates::geometry,
      ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
    )
    ORDER BY l.name ASC
    LIMIT 300
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
          'distance_miles', 0
        )
        ORDER BY name ASC
      ) AS spots
    FROM in_view
    GROUP BY category
  ) grouped;
$$;

GRANT EXECUTE ON FUNCTION public.get_categorized_spots_in_bbox(
  double precision,
  double precision,
  double precision,
  double precision
) TO anon, authenticated;

COMMENT ON FUNCTION public.get_categorized_spots_in_bbox IS
  'Viewport bbox categorized water bodies for the Global Explorer Discovery Dashboard.';
