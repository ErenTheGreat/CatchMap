/*
# Fix species RPC overload + category mapping for Creek/Lake/Bay/Other

- Removes duplicate get_species_availability_for_location(uuid, integer) that caused PGRST203
- Maps locations.category to species_availability.location_category keys
*/

DROP FUNCTION IF EXISTS public.get_species_availability_for_location(uuid, integer);

CREATE OR REPLACE FUNCTION public.location_category_to_availability_key(p_category text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_category
    WHEN 'Creek' THEN 'Rivers & Creeks'
    WHEN 'Lake' THEN 'Lakes & Ponds'
    WHEN 'Bay' THEN 'Bays & Oceans'
    WHEN 'Other' THEN 'Lakes & Ponds'
    WHEN 'Rivers & Creeks' THEN 'Rivers & Creeks'
    WHEN 'Lakes & Ponds' THEN 'Lakes & Ponds'
    WHEN 'Bays & Oceans' THEN 'Bays & Oceans'
    ELSE COALESCE(p_category, 'Lakes & Ponds')
  END;
$$;

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
  v_lookup_category text;
  v_result jsonb;
BEGIN
  SELECT COALESCE(
    l.category,
    public.infer_location_category(l.name, l.water_type)
  )
  INTO v_category
  FROM public.locations l
  WHERE l.id = p_location_id;

  v_lookup_category := public.location_category_to_availability_key(v_category);

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

  IF v_lookup_category IS NOT NULL THEN
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
    WHERE sa.location_id IS NULL
      AND sa.location_category = v_lookup_category
      AND public.month_in_availability_range(p_month, sa.month_start, sa.month_end);

    IF v_result IS NOT NULL AND v_result <> '[]'::jsonb THEN
      RETURN v_result;
    END IF;
  END IF;

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
