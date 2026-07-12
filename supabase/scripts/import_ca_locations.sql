/*
# Import rows into public.locations (Supabase SQL Editor)

Schema:
  id          uuid        DEFAULT gen_random_uuid() — omit on INSERT
  name        text        NOT NULL
  category    text        CHECK IN ('Creek', 'Lake', 'Bay', 'Other')
  water_type  water_type_enum
  coordinates PostGIS point (geography or geometry, SRID 4326)

CSV → staging columns: name, lat, lng, category
Do NOT include id in CSV.
*/

-- ===========================================================================
-- 1. Inspect enum values (run this first)
-- ===========================================================================

-- All labels on water_type_enum
SELECT
  e.enumlabel AS water_type_value,
  e.enumsortorder AS sort_order
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND t.typname = 'water_type_enum'
ORDER BY e.enumsortorder;

-- Quick one-liner alternative:
-- SELECT unnest(enum_range(NULL::public.water_type_enum)) AS water_type_value;

-- Confirm coordinates column type (geography vs geometry)
SELECT
  column_name,
  udt_schema,
  udt_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'locations'
  AND column_name IN ('coordinates', 'category', 'water_type');

-- Current category constraint
SELECT c.conname, pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'locations'
  AND c.conname = 'locations_category_check';


-- ===========================================================================
-- 2. Staging table (import CSV here via Dashboard)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.locations_import_staging (
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  category text NOT NULL
);


-- ===========================================================================
-- 3. Single-row INSERT template (copy/paste and edit)
-- ===========================================================================

-- Omit id — gen_random_uuid() fills it automatically.
-- ST_MakePoint takes (longitude, latitude) — X then Y.

INSERT INTO public.locations (name, category, water_type, coordinates)
VALUES (
  'Lake Shasta',
  'Lake',
  'freshwater'::public.water_type_enum,
  ST_SetSRID(ST_MakePoint(-122.370, 40.718), 4326)::extensions.geography
);

-- If your column is geometry (not geography), use this cast instead:
-- ST_SetSRID(ST_MakePoint(-122.370, 40.718), 4326)::geometry(Point, 4326)

-- Valid water_type_enum strings (from migration 003):
--   'freshwater' | 'saltwater' | 'brackish'

-- Valid category strings:
--   'Creek' | 'Lake' | 'Bay' | 'Other'


-- ===========================================================================
-- 4. Bulk INSERT from staging (recommended for CSV import)
-- ===========================================================================

INSERT INTO public.locations (name, category, water_type, coordinates)
SELECT
  trim(s.name),
  s.category,
  CASE s.category
    WHEN 'Bay'   THEN 'saltwater'::public.water_type_enum
    WHEN 'Creek' THEN 'freshwater'::public.water_type_enum
    WHEN 'Lake'  THEN 'freshwater'::public.water_type_enum
    ELSE 'freshwater'::public.water_type_enum  -- 'Other' default
  END,
  ST_SetSRID(ST_MakePoint(s.lng, s.lat), 4326)::extensions.geography
FROM public.locations_import_staging s
WHERE s.lat BETWEEN -90 AND 90
  AND s.lng BETWEEN -180 AND 180
  AND s.category IN ('Creek', 'Lake', 'Bay', 'Other');

-- geometry column variant (uncomment if udt_name = 'geometry' above):
-- INSERT INTO public.locations (name, category, water_type, coordinates)
-- SELECT
--   trim(s.name),
--   s.category,
--   CASE s.category
--     WHEN 'Bay'   THEN 'saltwater'::public.water_type_enum
--     WHEN 'Creek' THEN 'freshwater'::public.water_type_enum
--     WHEN 'Lake'  THEN 'freshwater'::public.water_type_enum
--     ELSE 'freshwater'::public.water_type_enum
--   END,
--   ST_SetSRID(ST_MakePoint(s.lng, s.lat), 4326)::geometry(Point, 4326)
-- FROM public.locations_import_staging s
-- WHERE s.lat BETWEEN -90 AND 90
--   AND s.lng BETWEEN -180 AND 180
--   AND s.category IN ('Creek', 'Lake', 'Bay', 'Other');

ANALYZE public.locations;


-- ===========================================================================
-- 5. Pre-insert validation (catch errors before INSERT)
-- ===========================================================================

-- Staging rows that would be rejected
SELECT s.*, 'invalid lat/lng or category' AS reason
FROM public.locations_import_staging s
WHERE s.lat NOT BETWEEN -90 AND 90
   OR s.lng NOT BETWEEN -180 AND 180
   OR s.category NOT IN ('Creek', 'Lake', 'Bay', 'Other');

-- Preview mapped water_type
SELECT
  s.name,
  s.category,
  CASE s.category
    WHEN 'Bay'   THEN 'saltwater'
    WHEN 'Creek' THEN 'freshwater'
    WHEN 'Lake'  THEN 'freshwater'
    ELSE 'freshwater'
  END AS mapped_water_type,
  s.lat,
  s.lng
FROM public.locations_import_staging s
LIMIT 20;


-- ===========================================================================
-- 6. Post-import validation
-- ===========================================================================

SELECT category, water_type, count(*) AS row_count
FROM public.locations
GROUP BY 1, 2
ORDER BY 1, 2;

SELECT id, name, category, water_type
FROM public.locations
WHERE category NOT IN ('Creek', 'Lake', 'Bay', 'Other')
   OR water_type NOT IN ('freshwater'::public.water_type_enum, 'saltwater'::public.water_type_enum, 'brackish'::public.water_type_enum);

SELECT
  id,
  name,
  ST_Y(coordinates::geometry) AS lat,
  ST_X(coordinates::geometry) AS lng
FROM public.locations
WHERE coordinates IS NULL;

-- DROP TABLE IF EXISTS public.locations_import_staging;
