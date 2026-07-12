/*
# Catch Intelligence Flywheel: per-user catch sync + anonymized community aggregation

Extends `catch_logs` (schema 003) so it can serve as the cloud sync target for
the app's full CatchRecord shape, while keeping raw rows private per user.

Changes:
  1. catch_logs gains the full app catch shape (species name/client id, length,
     notes, location name, photo, conditions) plus:
       - client_id: client-generated id for idempotent upserts from the app
       - shared_anonymously: per-catch opt-in flag; only these rows feed the
         community aggregation RPC (private by default)
       - latitude/longitude plain columns; a trigger maintains the PostGIS
         `location` geography so spatial RPCs keep working
  2. species_id / location relax to nullable — the app logs species from its
     bundled catalog (text ids) and catches may lack GPS.
  3. get_catch_activity_near_point keeps its exact signature but now only
     aggregates rows where shared_anonymously = true, grouped by species name.
     No raw rows, user ids, or precise locations are ever exposed.
  4. Private `catch-photos` storage bucket with per-user folder policies.

RLS on catch_logs (own-rows CRUD, from migration 003) is unchanged and remains
the privacy backstop: only the SECURITY DEFINER aggregate can read across users.
*/

-- ---------------------------------------------------------------------------
-- 1 + 2. Extend catch_logs to hold the app's full catch record
-- ---------------------------------------------------------------------------
ALTER TABLE public.catch_logs ALTER COLUMN species_id DROP NOT NULL;
ALTER TABLE public.catch_logs ALTER COLUMN location DROP NOT NULL;
ALTER TABLE public.catch_logs ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.catch_logs
  ADD COLUMN IF NOT EXISTS client_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS species_name text,
  ADD COLUMN IF NOT EXISTS species_client_id text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_name text,
  ADD COLUMN IF NOT EXISTS length text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS photo_uri text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS conditions jsonb,
  ADD COLUMN IF NOT EXISTS shared_anonymously boolean NOT NULL DEFAULT false;

-- Backfill species_name for any pre-existing rows that only have the FK.
UPDATE public.catch_logs cl
SET species_name = s.name
FROM public.species s
WHERE cl.species_id = s.id AND cl.species_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_catch_logs_shared
  ON public.catch_logs (shared_anonymously)
  WHERE shared_anonymously;

COMMENT ON COLUMN public.catch_logs.client_id IS
  'Client-generated id for idempotent upserts (offline-first sync).';
COMMENT ON COLUMN public.catch_logs.shared_anonymously IS
  'Per-catch opt-in. Only true rows feed anonymized community aggregates.';

-- Keep the PostGIS geography in sync with plain lat/lng so the app never has
-- to build WKT/WKB payloads and spatial RPCs keep working.
CREATE OR REPLACE FUNCTION public.catch_logs_sync_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(
      ST_MakePoint(NEW.longitude, NEW.latitude), 4326
    )::extensions.geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_catch_logs_sync_location ON public.catch_logs;
CREATE TRIGGER trg_catch_logs_sync_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON public.catch_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.catch_logs_sync_location();

-- ---------------------------------------------------------------------------
-- 3. Community aggregation: same signature, opt-in rows only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_catch_activity_near_point(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters double precision DEFAULT 25000,
  p_days_back integer DEFAULT 90
)
RETURNS TABLE (
  species_id uuid,
  species_name text,
  catch_count bigint,
  top_lures text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH shared AS (
    SELECT
      COALESCE(cl.species_name, s0.name) AS sname,
      cl.lure_used
    FROM public.catch_logs cl
    LEFT JOIN public.species s0 ON s0.id = cl.species_id
    WHERE cl.shared_anonymously
      AND cl.location IS NOT NULL
      AND ST_DWithin(
        cl.location,
        ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::extensions.geography,
        p_radius_meters
      )
      AND cl.caught_at_timestamp >= now() - (p_days_back || ' days')::interval
      AND COALESCE(cl.species_name, s0.name) IS NOT NULL
  )
  SELECT
    (
      SELECT s.id FROM public.species s
      WHERE lower(s.name) = lower(grouped.sname)
      LIMIT 1
    ) AS species_id,
    grouped.sname AS species_name,
    grouped.catch_count,
    ARRAY(
      SELECT sh2.lure_used
      FROM shared sh2
      WHERE sh2.sname = grouped.sname
        AND sh2.lure_used IS NOT NULL
        AND sh2.lure_used <> ''
      GROUP BY sh2.lure_used
      ORDER BY COUNT(*) DESC
      LIMIT 3
    ) AS top_lures
  FROM (
    SELECT sh.sname, COUNT(*)::bigint AS catch_count
    FROM shared sh
    GROUP BY sh.sname
  ) grouped
  ORDER BY grouped.catch_count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_catch_activity_near_point(double precision, double precision, double precision, integer)
  TO anon, authenticated;

COMMENT ON FUNCTION public.get_catch_activity_near_point IS
  'SECURITY DEFINER aggregate RPC. Returns anonymized species activity near a point from opt-in (shared_anonymously) catches only.';

-- ---------------------------------------------------------------------------
-- 4. Private catch-photos bucket, per-user folders ({user_id}/{client_id}.ext)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('catch-photos', 'catch-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "catch_photos_select_own" ON storage.objects;
CREATE POLICY "catch_photos_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'catch-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "catch_photos_insert_own" ON storage.objects;
CREATE POLICY "catch_photos_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'catch-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "catch_photos_update_own" ON storage.objects;
CREATE POLICY "catch_photos_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'catch-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'catch-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "catch_photos_delete_own" ON storage.objects;
CREATE POLICY "catch_photos_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'catch-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
