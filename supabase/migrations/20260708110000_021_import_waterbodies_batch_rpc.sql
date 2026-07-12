/*
# import_waterbodies_batch RPC — reproducible bulk waterbody import

Used by scripts/import-json-via-rpc.js for regional NHD imports.
Accepts a JSON array of { name, lat, lng, category } rows and inserts
with 250m name dedupe. Returns count of rows inserted.
*/

CREATE OR REPLACE FUNCTION public.import_waterbodies_batch(rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
DECLARE
  inserted integer;
BEGIN
  INSERT INTO public.locations (name, category, water_type, coordinates)
  SELECT
    r->>'name',
    r->>'category',
    CASE
      WHEN r->>'category' = 'Bay' THEN 'saltwater'::public.water_type_enum
      ELSE 'freshwater'::public.water_type_enum
    END,
    ST_SetSRID(
      ST_MakePoint((r->>'lng')::double precision, (r->>'lat')::double precision),
      4326
    )::geography
  FROM jsonb_array_elements(rows) AS r
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.locations l
    WHERE lower(trim(l.name)) = lower(trim(r->>'name'))
      AND ST_DWithin(
        l.coordinates,
        ST_SetSRID(
          ST_MakePoint((r->>'lng')::double precision, (r->>'lat')::double precision),
          4326
        )::geography,
        250
      )
  );

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_waterbodies_batch(jsonb) TO anon, authenticated;

COMMENT ON FUNCTION public.import_waterbodies_batch(jsonb) IS
  'Bulk-import waterbody rows from NHD regional JSON. Dedupes by name within 250m.';
