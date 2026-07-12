/*
# Fishing Engine Schema (PostGIS + RLS)

Scalable data layer for the Worldwide Fishing Forecast & Recommendation Engine.
Supports API-sourced species/location catalogs (GBIF, FishBase) and crowdsourced
catch logs tied to authenticated users.

Tables:
  - species            Global fish catalog
  - locations          Named water bodies / regions (PostGIS point)
  - species_locations  Many-to-many presence mapping
  - catch_logs         User-submitted catches for algorithm training

PostGIS enables ST_DWithin / ST_Distance queries from MapLibre coordinates.

Note: Legacy tables `fishing_spots` and `catches` remain unchanged for backward
compatibility. New engine code should prefer these normalized tables.
*/

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'primary_biome_type') THEN
    CREATE TYPE public.primary_biome_type AS ENUM (
      'freshwater_lake',
      'freshwater_river',
      'coastal_saltwater',
      'tropical_estuary',
      'brackish_bay',
      'unknown'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'water_type_enum') THEN
    CREATE TYPE public.water_type_enum AS ENUM (
      'saltwater',
      'freshwater',
      'brackish'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'species_data_source') THEN
    CREATE TYPE public.species_data_source AS ENUM (
      'API',
      'User',
      'GBIF',
      'FishBase',
      'Manual'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- species
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.species (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scientific_name text NOT NULL,
  primary_biome public.primary_biome_type NOT NULL DEFAULT 'unknown',
  ideal_temp_min numeric(5, 2),
  ideal_temp_max numeric(5, 2),
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT species_ideal_temp_range_check
    CHECK (
      ideal_temp_min IS NULL
      OR ideal_temp_max IS NULL
      OR ideal_temp_min <= ideal_temp_max
    ),
  CONSTRAINT species_scientific_name_unique UNIQUE (scientific_name)
);

CREATE INDEX IF NOT EXISTS idx_species_name
  ON public.species (name);

CREATE INDEX IF NOT EXISTS idx_species_primary_biome
  ON public.species (primary_biome);

COMMENT ON TABLE public.species IS
  'Global fish species catalog. Populated by Edge Functions (GBIF/FishBase) and manual curation.';

-- ---------------------------------------------------------------------------
-- locations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  coordinates extensions.geography(POINT, 4326) NOT NULL,
  water_type public.water_type_enum NOT NULL DEFAULT 'freshwater',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_coordinates
  ON public.locations USING GIST (coordinates);

CREATE INDEX IF NOT EXISTS idx_locations_water_type
  ON public.locations (water_type);

COMMENT ON TABLE public.locations IS
  'Named fishing locations. coordinates stores WGS84 lon/lat as geography for meter-accurate distance queries.';

-- ---------------------------------------------------------------------------
-- species_locations (many-to-many)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.species_locations (
  species_id uuid NOT NULL REFERENCES public.species (id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations (id) ON DELETE CASCADE,
  data_source public.species_data_source NOT NULL DEFAULT 'API',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (species_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_species_locations_location_id
  ON public.species_locations (location_id);

CREATE INDEX IF NOT EXISTS idx_species_locations_data_source
  ON public.species_locations (data_source);

COMMENT ON TABLE public.species_locations IS
  'Maps which species are documented at which locations. Upserted by GBIF Edge Function or user reports.';

-- ---------------------------------------------------------------------------
-- catch_logs (crowdsourced)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  species_id uuid NOT NULL REFERENCES public.species (id) ON DELETE RESTRICT,
  location extensions.geography(POINT, 4326) NOT NULL,
  weight text NOT NULL,
  lure_used text,
  caught_at_timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catch_logs_user_id
  ON public.catch_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_catch_logs_species_id
  ON public.catch_logs (species_id);

CREATE INDEX IF NOT EXISTS idx_catch_logs_caught_at
  ON public.catch_logs (caught_at_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_catch_logs_location
  ON public.catch_logs USING GIST (location);

COMMENT ON TABLE public.catch_logs IS
  'Authenticated user catch submissions. Powers localized activity scoring and lure effectiveness trends.';

-- ---------------------------------------------------------------------------
-- Spatial helper: species near a MapLibre coordinate
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_species_near_point(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters double precision DEFAULT 50000
)
RETURNS TABLE (
  species_id uuid,
  species_name text,
  scientific_name text,
  primary_biome public.primary_biome_type,
  ideal_temp_min numeric,
  ideal_temp_max numeric,
  image_url text,
  location_id uuid,
  location_name text,
  water_type public.water_type_enum,
  distance_meters double precision,
  data_source public.species_data_source
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT
    s.id,
    s.name,
    s.scientific_name,
    s.primary_biome,
    s.ideal_temp_min,
    s.ideal_temp_max,
    s.image_url,
    l.id,
    l.name,
    l.water_type,
    ST_Distance(
      l.coordinates,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::extensions.geography
    ) AS distance_meters,
    sl.data_source
  FROM public.species_locations sl
  JOIN public.species s ON s.id = sl.species_id
  JOIN public.locations l ON l.id = sl.location_id
  WHERE ST_DWithin(
    l.coordinates,
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::extensions.geography,
    p_radius_meters
  )
  ORDER BY distance_meters ASC, s.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_species_near_point(double precision, double precision, double precision)
  TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.species ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.species_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catch_logs ENABLE ROW LEVEL SECURITY;

-- species: public read-only for clients; writes via service_role (Edge Functions)
DROP POLICY IF EXISTS "species_public_read" ON public.species;
CREATE POLICY "species_public_read"
  ON public.species
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- locations: public read-only
DROP POLICY IF EXISTS "locations_public_read" ON public.locations;
CREATE POLICY "locations_public_read"
  ON public.locations
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- species_locations: public read-only
DROP POLICY IF EXISTS "species_locations_public_read" ON public.species_locations;
CREATE POLICY "species_locations_public_read"
  ON public.species_locations
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- catch_logs: users manage their own rows; read own catches only (privacy-first)
DROP POLICY IF EXISTS "catch_logs_select_own" ON public.catch_logs;
CREATE POLICY "catch_logs_select_own"
  ON public.catch_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "catch_logs_insert_own" ON public.catch_logs;
CREATE POLICY "catch_logs_insert_own"
  ON public.catch_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "catch_logs_update_own" ON public.catch_logs;
CREATE POLICY "catch_logs_update_own"
  ON public.catch_logs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "catch_logs_delete_own" ON public.catch_logs;
CREATE POLICY "catch_logs_delete_own"
  ON public.catch_logs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Aggregated catch stats for the forecast engine (no raw user data exposed)
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
  SELECT
    s.id,
    s.name,
    COUNT(*)::bigint AS catch_count,
    ARRAY(
      SELECT cl2.lure_used
      FROM public.catch_logs cl2
      WHERE cl2.species_id = s.id
        AND cl2.lure_used IS NOT NULL
        AND ST_DWithin(
          cl2.location,
          ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::extensions.geography,
          p_radius_meters
        )
        AND cl2.caught_at_timestamp >= now() - (p_days_back || ' days')::interval
      GROUP BY cl2.lure_used
      ORDER BY COUNT(*) DESC
      LIMIT 3
    ) AS top_lures
  FROM public.catch_logs cl
  JOIN public.species s ON s.id = cl.species_id
  WHERE ST_DWithin(
    cl.location,
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::extensions.geography,
    p_radius_meters
  )
  AND cl.caught_at_timestamp >= now() - (p_days_back || ' days')::interval
  GROUP BY s.id, s.name
  ORDER BY catch_count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_catch_activity_near_point(double precision, double precision, double precision, integer)
  TO anon, authenticated;

COMMENT ON FUNCTION public.get_catch_activity_near_point IS
  'SECURITY DEFINER aggregate RPC. Returns anonymized species activity near a point without exposing individual catch_logs rows.';
