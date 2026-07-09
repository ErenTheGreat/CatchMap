/*
# Scale locations — stored category, indexes, RPC updates

Adds a persisted category column for CSV import at scale, pg_trgm name search,
species_availability dedup index + RLS, and updates RPCs to prefer stored category.

Requires: 20260706180000_010_species_availability.sql
*/

-- ---------------------------------------------------------------------------
-- pg_trgm for name search at scale
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Stored category on locations (CSV import target)
-- ---------------------------------------------------------------------------
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS category text
    CHECK (category IN ('Lakes & Ponds', 'Rivers & Creeks', 'Bays & Oceans'));

UPDATE public.locations l
SET category = public.infer_location_category(l.name, l.water_type)
WHERE l.category IS NULL;

CREATE INDEX IF NOT EXISTS idx_locations_category
  ON public.locations (category);

CREATE INDEX IF NOT EXISTS idx_locations_name_trgm
  ON public.locations USING gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- species_availability — dedup category defaults + RLS
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_species_availability_category_unique
  ON public.species_availability (species_id, location_category, month_start, month_end)
  WHERE location_id IS NULL;

ALTER TABLE public.species_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS species_availability_public_read ON public.species_availability;
CREATE POLICY species_availability_public_read
  ON public.species_availability
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- RPC: get_categorized_nearby_spots — use stored category
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_categorized_nearby_spots(
  double precision,
  double precision
);

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
      COALESCE(
        l.category,
        CASE
          WHEN l.water_type = 'saltwater'
            OR l.name ILIKE ANY (ARRAY['%bay%', '%ocean%', '%harbor%', '%harbour%', '%beach%', '%coast%'])
            THEN 'Bays & Oceans'
          WHEN l.name ILIKE ANY (ARRAY['%river%', '%creek%', '%stream%', '%run%'])
            THEN 'Rivers & Creeks'
          ELSE 'Lakes & Ponds'
        END
      ) AS category
    FROM public.locations l
    CROSS JOIN user_point up
    WHERE ST_DWithin(l.coordinates, up.geom, 80467.2)
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

-- ---------------------------------------------------------------------------
-- RPC: get_categorized_spots_in_bbox — stored category + per-category cap
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_categorized_spots_in_bbox(
  double precision,
  double precision,
  double precision,
  double precision
);

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
      COALESCE(
        l.category,
        CASE
          WHEN l.water_type = 'saltwater'
            OR l.name ILIKE ANY (ARRAY['%bay%', '%ocean%', '%harbor%', '%harbour%', '%beach%', '%coast%'])
            THEN 'Bays & Oceans'
          WHEN l.name ILIKE ANY (ARRAY['%river%', '%creek%', '%stream%', '%run%'])
            THEN 'Rivers & Creeks'
          ELSE 'Lakes & Ponds'
        END
      ) AS category
    FROM public.locations l
    WHERE ST_Intersects(
      l.coordinates::geometry,
      ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
    )
  ),
  capped AS (
    SELECT *
    FROM (
      SELECT
        iv.*,
        ROW_NUMBER() OVER (PARTITION BY iv.category ORDER BY iv.name ASC) AS rn
      FROM in_view iv
    ) ranked
    WHERE rn <= 100
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
    FROM capped
    GROUP BY category
  ) grouped;
$$;

-- ---------------------------------------------------------------------------
-- RPC: get_species_availability_for_location — prefer stored category
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_species_availability_for_location(uuid, smallint);

CREATE OR REPLACE FUNCTION public.get_species_availability_for_location(
  p_location_id uuid,
  p_month smallint DEFAULT EXTRACT(MONTH FROM now())::smallint
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_category text;
  v_result jsonb;
BEGIN
  SELECT COALESCE(
    l.category,
    public.infer_location_category(l.name, l.water_type)
  )
  INTO v_category
  FROM public.locations l
  WHERE l.id = p_location_id;

  -- 1) Location-specific availability for current month
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'species_id', s.id,
        'species_name', s.name,
        'scientific_name', s.scientific_name,
        'image_url', s.image_url,
        'feeding_zone', s.feeding_zone,
        'ideal_temp_min', s.ideal_temp_min,
        'ideal_temp_max', s.ideal_temp_max,
        'month_start', sa.month_start,
        'month_end', sa.month_end,
        'source', 'location'
      )
      ORDER BY s.name ASC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM public.species_availability sa
  JOIN public.species s ON s.id = sa.species_id
  WHERE sa.location_id = p_location_id
    AND public.month_in_availability_range(p_month, sa.month_start, sa.month_end);

  IF v_result IS NOT NULL AND v_result <> '[]'::jsonb THEN
    RETURN v_result;
  END IF;

  -- 2) Category-wide availability fallback
  IF v_category IS NOT NULL THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'species_id', s.id,
          'species_name', s.name,
          'scientific_name', s.scientific_name,
          'image_url', s.image_url,
          'feeding_zone', s.feeding_zone,
          'ideal_temp_min', s.ideal_temp_min,
          'ideal_temp_max', s.ideal_temp_max,
          'month_start', sa.month_start,
          'month_end', sa.month_end,
          'source', 'category'
        )
        ORDER BY s.name ASC
      ),
      '[]'::jsonb
    )
    INTO v_result
    FROM public.species_availability sa
    JOIN public.species s ON s.id = sa.species_id
    WHERE sa.location_category = v_category
      AND sa.location_id IS NULL
      AND public.month_in_availability_range(p_month, sa.month_start, sa.month_end);

    IF v_result IS NOT NULL AND v_result <> '[]'::jsonb THEN
      RETURN v_result;
    END IF;
  END IF;

  -- 3) Final fallback: species_locations (no month filter)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'species_id', s.id,
        'species_name', s.name,
        'scientific_name', s.scientific_name,
        'image_url', s.image_url,
        'feeding_zone', s.feeding_zone,
        'ideal_temp_min', s.ideal_temp_min,
        'ideal_temp_max', s.ideal_temp_max,
        'month_start', 1,
        'month_end', 12,
        'source', 'presence'
      )
      ORDER BY s.name ASC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM public.species_locations sl
  JOIN public.species s ON s.id = sl.species_id
  WHERE sl.location_id = p_location_id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_species_availability_for_location(uuid, smallint)
  TO anon, authenticated;

COMMENT ON COLUMN public.locations.category IS
  'FishAngler-style water body category. Set from CSV import; falls back to infer_location_category when null.';

ANALYZE public.locations;
