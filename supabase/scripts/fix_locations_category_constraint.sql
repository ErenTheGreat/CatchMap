/*
# Fix locations.category check constraint (idempotent)

Run in Supabase SQL Editor.

Target allowed values: Creek | Lake | Bay | Other

IMPORTANT: Your app RPCs (get_categorized_spots_in_bbox, species_availability, etc.)
currently expect 'Lakes & Ponds', 'Rivers & Creeks', 'Bays & Oceans'. After this fix,
update those functions and species_availability.location_category to match Creek/Lake/Bay/Other
or map categories in the RPC layer.
*/

-- ===========================================================================
-- STEP 1 — DATA AUDIT (run first; read-only)
-- ===========================================================================

-- All distinct category values, including NULL bucket
SELECT
  COALESCE(category, '<<NULL>>') AS category_value,
  count(*) AS row_count
FROM public.locations
GROUP BY 1
ORDER BY 2 DESC, 1;

-- Rows that would violate the new constraint (preview before fix)
SELECT id, name, category, water_type
FROM public.locations
WHERE category IS NULL
   OR category NOT IN ('Creek', 'Lake', 'Bay', 'Other');

-- Existing check constraints on locations.category
SELECT
  c.conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'locations'
  AND c.contype = 'c'
  AND pg_get_constraintdef(c.oid) ILIKE '%category%';


-- ===========================================================================
-- STEP 2 — CONSTRAINT RESET (idempotent; safe to re-run)
-- ===========================================================================

BEGIN;

-- Remove old check constraint(s) on category
ALTER TABLE public.locations
  DROP CONSTRAINT IF EXISTS locations_category_check;

-- Drop inline CHECK from ADD COLUMN IF NOT EXISTS (may use same or different name)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'locations'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%category%'
  LOOP
    EXECUTE format('ALTER TABLE public.locations DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- Map known legacy / CSV labels to the new standard set
UPDATE public.locations
SET category = CASE
  WHEN category IS NULL THEN 'Other'
  WHEN trim(category) IN ('Creek', 'River', 'Rivers & Creeks', 'Stream') THEN 'Creek'
  WHEN trim(category) IN ('Lake', 'Pond', 'Lakes & Ponds', 'Reservoir') THEN 'Lake'
  WHEN trim(category) IN ('Bay', 'Ocean', 'Bays & Oceans', 'Harbor', 'Coast') THEN 'Bay'
  WHEN trim(category) IN ('Creek', 'Lake', 'Bay', 'Other') THEN trim(category)
  ELSE 'Other'
END;

-- Catch values that landed in water_type by mistake (e.g. 'freshwater', 'saltwater')
UPDATE public.locations
SET category = 'Other'
WHERE category NOT IN ('Creek', 'Lake', 'Bay', 'Other');

-- Safety net: anything still NULL becomes Other
UPDATE public.locations
SET category = 'Other'
WHERE category IS NULL;

-- Apply the new constraint
ALTER TABLE public.locations
  ADD CONSTRAINT locations_category_check
  CHECK (category IN ('Creek', 'Lake', 'Bay', 'Other'));

COMMIT;


-- ===========================================================================
-- STEP 3 — VALIDATION (run after reset)
-- ===========================================================================

-- Constraint should exist with the expected definition
SELECT
  c.conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'locations'
  AND c.conname = 'locations_category_check';

-- Distribution after fix
SELECT category, count(*) AS row_count
FROM public.locations
GROUP BY 1
ORDER BY 1;

-- Must return zero rows
SELECT id, name, category
FROM public.locations
WHERE category IS NULL
   OR category NOT IN ('Creek', 'Lake', 'Bay', 'Other');

-- Optional: prove INSERT enforcement works (should error if uncommented with bad value)
-- INSERT INTO public.locations (name, coordinates, category, water_type)
-- VALUES (
--   'Constraint test',
--   ST_SetSRID(ST_MakePoint(-122.0, 37.5), 4326)::extensions.geography,
--   'freshwater',
--   'freshwater'
-- );
