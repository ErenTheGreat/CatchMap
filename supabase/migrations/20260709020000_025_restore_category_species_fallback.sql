-- Restore category-wide species defaults as a third tier in location lookup.
-- Migration 022 removed this fallback; imported US locations lack per-location
-- species_availability rows, so spots returned empty species lists.

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
    CASE l.category
      WHEN 'Lake' THEN 'Lakes & Ponds'
      WHEN 'Creek' THEN 'Rivers & Creeks'
      WHEN 'Bay' THEN 'Bays & Oceans'
      ELSE l.category
    END,
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

  -- 2) species_locations presence (no month filter)
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

  IF v_result IS NOT NULL AND v_result <> '[]'::jsonb THEN
    RETURN v_result;
  END IF;

  -- 3) Category-wide defaults for imported locations without per-location data
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
  END IF;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_species_availability_for_location(uuid, smallint)
  TO anon, authenticated;

COMMENT ON FUNCTION public.get_species_availability_for_location IS
  'Species at a location: per-location availability, species_locations presence, then category defaults.';
