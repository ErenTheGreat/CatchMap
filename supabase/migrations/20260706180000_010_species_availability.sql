/*
# species_availability + get_species_availability_for_location RPC

Seasonal presence windows per species/location for the "What to Catch" feature.
Extends species with feeding_zone for weather-based activity scoring.

Requires: 20260705183000_003_fishing_engine_schema.sql, 20260706120000_007_seed_bay_area_locations.sql
*/

-- ---------------------------------------------------------------------------
-- Extend species — feeding zone for weather scoring
-- ---------------------------------------------------------------------------
ALTER TABLE public.species
  ADD COLUMN IF NOT EXISTS feeding_zone text NOT NULL DEFAULT 'mid'
    CHECK (feeding_zone IN ('surface', 'mid', 'bottom'));

UPDATE public.species SET feeding_zone = 'surface'
WHERE scientific_name IN (
  'Micropterus salmoides',
  'Micropterus dolomieu',
  'Lepomis macrochirus',
  'Lepomis cyanellus',
  'Pomoxis nigromaculatus'
);

UPDATE public.species SET feeding_zone = 'bottom'
WHERE scientific_name IN (
  'Ictalurus punctatus',
  'Paralichthys californicus',
  'Myliobatis californica',
  'Triakis semifasciata'
);

-- Trout, salmon, striped bass remain 'mid' (default)

-- ---------------------------------------------------------------------------
-- species_availability
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.species_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  species_id uuid NOT NULL REFERENCES public.species (id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations (id) ON DELETE CASCADE,
  location_category text CHECK (
    location_category IN ('Lakes & Ponds', 'Rivers & Creeks', 'Bays & Oceans')
  ),
  month_start smallint NOT NULL CHECK (month_start BETWEEN 1 AND 12),
  month_end smallint NOT NULL CHECK (month_end BETWEEN 1 AND 12),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT species_availability_target_check CHECK (
    location_id IS NOT NULL OR location_category IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_species_availability_location
  ON public.species_availability (location_id, month_start, month_end);

CREATE INDEX IF NOT EXISTS idx_species_availability_category
  ON public.species_availability (location_category, month_start, month_end);

COMMENT ON TABLE public.species_availability IS
  'Seasonal availability windows linking species to locations or water categories.';

-- ---------------------------------------------------------------------------
-- Month-in-range helper (supports wrap-around, e.g. Nov–Feb)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.month_in_availability_range(
  p_month smallint,
  p_start smallint,
  p_end smallint
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_start <= p_end THEN p_month >= p_start AND p_month <= p_end
    ELSE p_month >= p_start OR p_month <= p_end
  END;
$$;

-- ---------------------------------------------------------------------------
-- Infer location category (matches categorized spots RPCs)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.infer_location_category(
  p_name text,
  p_water_type public.water_type_enum
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_water_type = 'saltwater'
      OR p_name ILIKE ANY (ARRAY['%bay%', '%ocean%', '%harbor%', '%harbour%', '%beach%', '%coast%'])
      THEN 'Bays & Oceans'
    WHEN p_name ILIKE ANY (ARRAY['%river%', '%creek%', '%stream%', '%run%'])
      THEN 'Rivers & Creeks'
    ELSE 'Lakes & Ponds'
  END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: get_species_availability_for_location
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
  SELECT public.infer_location_category(l.name, l.water_type)
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

COMMENT ON FUNCTION public.get_species_availability_for_location IS
  'Species available at a location for a given month — location availability, category fallback, then species_locations.';

-- ---------------------------------------------------------------------------
-- Seed species_availability for Bay Area locations (from species.json bestMonths)
-- ---------------------------------------------------------------------------
INSERT INTO public.species_availability (species_id, location_id, month_start, month_end)
SELECT s.id, sl.location_id, ranges.month_start, ranges.month_end
FROM public.species_locations sl
JOIN public.species s ON s.id = sl.species_id
JOIN (
  VALUES
    ('Micropterus salmoides', 3, 10),
    ('Oncorhynchus mykiss', 1, 12),
    ('Ictalurus punctatus', 1, 12),
    ('Morone saxatilis', 4, 11),
    ('Micropterus dolomieu', 4, 10),
    ('Oncorhynchus nerka', 5, 10),
    ('Lepomis macrochirus', 4, 10),
    ('Pomoxis nigromaculatus', 3, 11),
    ('Lepomis cyanellus', 4, 10),
    ('Paralichthys californicus', 4, 10),
    ('Myliobatis californica', 5, 10),
    ('Triakis semifasciata', 5, 10)
) AS ranges(scientific_name, month_start, month_end)
  ON s.scientific_name = ranges.scientific_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.species_availability sa
  WHERE sa.species_id = s.id
    AND sa.location_id = sl.location_id
    AND sa.month_start = ranges.month_start
    AND sa.month_end = ranges.month_end
);

-- Category-wide defaults for locations without per-location rows (future expansion)
INSERT INTO public.species_availability (species_id, location_category, month_start, month_end)
SELECT s.id, cat.category, ranges.month_start, ranges.month_end
FROM public.species s
CROSS JOIN (
  VALUES
    ('Lakes & Ponds'),
    ('Rivers & Creeks'),
    ('Bays & Oceans')
) AS cat(category)
JOIN (
  VALUES
    ('Micropterus salmoides', 3, 10),
    ('Oncorhynchus mykiss', 1, 12),
    ('Ictalurus punctatus', 1, 12),
    ('Morone saxatilis', 4, 11),
    ('Micropterus dolomieu', 4, 10),
    ('Lepomis macrochirus', 4, 10),
    ('Pomoxis nigromaculatus', 3, 11),
    ('Paralichthys californicus', 4, 10),
    ('Myliobatis californica', 5, 10),
    ('Triakis semifasciata', 5, 10)
) AS ranges(scientific_name, month_start, month_end)
  ON s.scientific_name = ranges.scientific_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.species_availability sa
  WHERE sa.species_id = s.id AND sa.location_category = cat.category
);
