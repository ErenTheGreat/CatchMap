/*
 ONE-SHOT DEPLOY — paste this entire file into Supabase SQL Editor and click Run.
 Rebuilt from supabase/migrations/ (003, 005, 006, 007, 009, 010, 011).
*/

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
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

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

-- Add category on existing DBs created before migration 011 (CREATE TABLE IF NOT EXISTS skips)
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS category text
    CHECK (category IN ('Lakes & Ponds', 'Rivers & Creeks', 'Bays & Oceans'));

CREATE INDEX IF NOT EXISTS idx_locations_coordinates
  ON public.locations USING GIST (coordinates);

CREATE INDEX IF NOT EXISTS idx_locations_water_type
  ON public.locations (water_type);

CREATE INDEX IF NOT EXISTS idx_locations_category
  ON public.locations (category);

CREATE INDEX IF NOT EXISTS idx_locations_name_trgm
  ON public.locations USING gin (name extensions.gin_trgm_ops);

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

/*
# get_locations_in_bbox RPC

Returns PostGIS locations whose coordinates fall inside the map viewport
envelope. Used by the mobile map to render pins globally as the camera moves.

Requires: 20260705183000_003_fishing_engine_schema.sql (locations table + PostGIS)
*/

DROP FUNCTION IF EXISTS public.get_locations_in_bbox(
  double precision,
  double precision,
  double precision,
  double precision
);

CREATE OR REPLACE FUNCTION public.get_locations_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
RETURNS TABLE (
  id uuid,
  name text,
  water_type public.water_type_enum,
  latitude double precision,
  longitude double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT
    l.id,
    l.name,
    l.water_type,
    ST_Y(l.coordinates::geometry) AS latitude,
    ST_X(l.coordinates::geometry) AS longitude
  FROM public.locations l
  WHERE ST_Intersects(
    l.coordinates::geometry,
    ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  )
  ORDER BY l.name ASC
  LIMIT 300;
$$;

GRANT EXECUTE ON FUNCTION public.get_locations_in_bbox(
  double precision,
  double precision,
  double precision,
  double precision
) TO anon, authenticated;

COMMENT ON FUNCTION public.get_locations_in_bbox IS
  'Viewport envelope query for map pins — returns WGS84 coordinates inside the bbox.';

/*
# get_spot_details RPC

Returns species documented at a fishing spot and aggregated best catch hours
from nearby catch_logs. Used by the map bottom sheet when a pin is selected.

Requires: 20260705183000_003_fishing_engine_schema.sql
*/

DROP FUNCTION IF EXISTS public.get_spot_details(double precision, double precision, uuid);

CREATE OR REPLACE FUNCTION public.get_spot_details(
  p_latitude double precision,
  p_longitude double precision,
  p_location_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_species jsonb;
  v_catch_times jsonb;
  v_point extensions.geography;
BEGIN
  v_point := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::extensions.geography;

  IF p_location_id IS NOT NULL THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'species_id', s.id,
          'species_name', s.name,
          'scientific_name', s.scientific_name,
          'primary_biome', s.primary_biome,
          'ideal_temp_min', s.ideal_temp_min,
          'ideal_temp_max', s.ideal_temp_max,
          'image_url', s.image_url,
          'data_source', sl.data_source
        )
        ORDER BY s.name ASC
      ),
      '[]'::jsonb
    )
    INTO v_species
    FROM public.species_locations sl
    JOIN public.species s ON s.id = sl.species_id
    WHERE sl.location_id = p_location_id;
  END IF;

  IF v_species IS NULL OR v_species = '[]'::jsonb THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'species_id', row.species_id,
          'species_name', row.species_name,
          'scientific_name', row.scientific_name,
          'primary_biome', row.primary_biome,
          'ideal_temp_min', row.ideal_temp_min,
          'ideal_temp_max', row.ideal_temp_max,
          'image_url', row.image_url,
          'data_source', row.data_source
        )
        ORDER BY row.species_name ASC
      ),
      '[]'::jsonb
    )
    INTO v_species
    FROM (
      SELECT DISTINCT ON (g.species_id)
        g.species_id,
        g.species_name,
        g.scientific_name,
        g.primary_biome,
        g.ideal_temp_min,
        g.ideal_temp_max,
        g.image_url,
        g.data_source
      FROM public.get_species_near_point(p_latitude, p_longitude, 500) AS g
      ORDER BY g.species_id, g.distance_meters ASC
    ) AS row;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'hour', agg.hour,
        'catch_count', agg.catch_count
      )
      ORDER BY agg.catch_count DESC, agg.hour ASC
    ),
    '[]'::jsonb
  )
  INTO v_catch_times
  FROM (
    SELECT
      EXTRACT(HOUR FROM cl.caught_at_timestamp AT TIME ZONE 'UTC')::integer AS hour,
      COUNT(*)::bigint AS catch_count
    FROM public.catch_logs cl
    WHERE ST_DWithin(cl.location, v_point, 1000)
      AND cl.caught_at_timestamp >= now() - interval '90 days'
    GROUP BY hour
    ORDER BY catch_count DESC, hour ASC
    LIMIT 5
  ) AS agg;

  RETURN jsonb_build_object(
    'species', COALESCE(v_species, '[]'::jsonb),
    'best_catch_times', COALESCE(v_catch_times, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_spot_details(
  double precision,
  double precision,
  uuid
) TO anon, authenticated;

COMMENT ON FUNCTION public.get_spot_details IS
  'Spot detail payload for map pin selection — species at location (or nearby) plus top catch hours from anonymized catch_logs aggregates.';

/*
# Seed Bay Area locations for map viewport pins

Populates public.locations + species + species_locations from the bundled
FishingDatabase.js dataset so get_locations_in_bbox returns pins in the
East Bay / SF Bay viewport.

Requires: 20260705183000_003_fishing_engine_schema.sql
*/

-- ---------------------------------------------------------------------------
-- Species catalog (idempotent by scientific_name)
-- ---------------------------------------------------------------------------
INSERT INTO public.species (name, scientific_name, primary_biome)
VALUES
  ('Largemouth Bass', 'Micropterus salmoides', 'freshwater_lake'),
  ('Rainbow Trout', 'Oncorhynchus mykiss', 'freshwater_river'),
  ('Channel Catfish', 'Ictalurus punctatus', 'freshwater_lake'),
  ('Striped Bass', 'Morone saxatilis', 'coastal_saltwater'),
  ('Smallmouth Bass', 'Micropterus dolomieu', 'freshwater_lake'),
  ('Kokanee Salmon', 'Oncorhynchus nerka', 'freshwater_lake'),
  ('Bluegill', 'Lepomis macrochirus', 'freshwater_lake'),
  ('Black Crappie', 'Pomoxis nigromaculatus', 'freshwater_lake'),
  ('Green Sunfish', 'Lepomis cyanellus', 'freshwater_lake'),
  ('California Halibut', 'Paralichthys californicus', 'coastal_saltwater'),
  ('Bat Ray', 'Myliobatis californica', 'coastal_saltwater'),
  ('Leopard Shark', 'Triakis semifasciata', 'coastal_saltwater')
ON CONFLICT (scientific_name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Locations (deterministic UUIDs aligned with bundled spot_* ids)
-- ---------------------------------------------------------------------------
INSERT INTO public.locations (id, name, coordinates, water_type)
VALUES
  (
    '11111111-1111-4111-8111-000000000001',
    'Shadow Cliffs Regional Recreation Area',
    ST_SetSRID(ST_MakePoint(-121.841891, 37.669352), 4326)::extensions.geography,
    'freshwater'
  ),
  (
    '11111111-1111-4111-8111-000000000002',
    'Lake Del Valle',
    ST_SetSRID(ST_MakePoint(-121.745415, 37.595627), 4326)::extensions.geography,
    'freshwater'
  ),
  (
    '11111111-1111-4111-8111-000000000003',
    'Quarry Lakes (Horseshoe Lake)',
    ST_SetSRID(ST_MakePoint(-121.986326, 37.575239), 4326)::extensions.geography,
    'freshwater'
  ),
  (
    '11111111-1111-4111-8111-000000000004',
    'Lake Chabot',
    ST_SetSRID(ST_MakePoint(-122.105477, 37.731776), 4326)::extensions.geography,
    'freshwater'
  ),
  (
    '11111111-1111-4111-8111-000000000005',
    'Don Castro Reservoir',
    ST_SetSRID(ST_MakePoint(-122.048737, 37.696142), 4326)::extensions.geography,
    'freshwater'
  ),
  (
    '11111111-1111-4111-8111-000000000006',
    'Lake Elizabeth',
    ST_SetSRID(ST_MakePoint(-121.965415, 37.550186), 4326)::extensions.geography,
    'freshwater'
  ),
  (
    '11111111-1111-4111-8111-000000000007',
    'Arroyo del Valle Creek (Section 1)',
    ST_SetSRID(ST_MakePoint(-121.852112, 37.659981), 4326)::extensions.geography,
    'freshwater'
  ),
  (
    '11111111-1111-4111-8111-000000000008',
    'San Francisco Bay - Alameda Shoreline',
    ST_SetSRID(ST_MakePoint(-122.285888, 37.766162), 4326)::extensions.geography,
    'saltwater'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  coordinates = EXCLUDED.coordinates,
  water_type = EXCLUDED.water_type;

-- ---------------------------------------------------------------------------
-- species_locations (Manual curation from bundled dataset)
-- ---------------------------------------------------------------------------
INSERT INTO public.species_locations (species_id, location_id, data_source)
SELECT s.id, l.id, 'Manual'::public.species_data_source
FROM public.species s
CROSS JOIN public.locations l
WHERE (l.id = '11111111-1111-4111-8111-000000000001' AND s.scientific_name IN (
  'Micropterus salmoides', 'Oncorhynchus mykiss', 'Ictalurus punctatus'
))
OR (l.id = '11111111-1111-4111-8111-000000000002' AND s.scientific_name IN (
  'Morone saxatilis', 'Micropterus dolomieu', 'Oncorhynchus nerka', 'Lepomis macrochirus'
))
OR (l.id = '11111111-1111-4111-8111-000000000003' AND s.scientific_name IN (
  'Micropterus salmoides', 'Micropterus dolomieu', 'Oncorhynchus mykiss'
))
OR (l.id = '11111111-1111-4111-8111-000000000004' AND s.scientific_name IN (
  'Micropterus salmoides', 'Pomoxis nigromaculatus', 'Oncorhynchus mykiss'
))
OR (l.id = '11111111-1111-4111-8111-000000000005' AND s.scientific_name IN (
  'Micropterus salmoides', 'Pomoxis nigromaculatus', 'Lepomis macrochirus'
))
OR (l.id = '11111111-1111-4111-8111-000000000006' AND s.scientific_name IN (
  'Micropterus salmoides', 'Lepomis macrochirus', 'Ictalurus punctatus'
))
OR (l.id = '11111111-1111-4111-8111-000000000007' AND s.scientific_name IN (
  'Micropterus salmoides', 'Lepomis cyanellus'
))
OR (l.id = '11111111-1111-4111-8111-000000000008' AND s.scientific_name IN (
  'Paralichthys californicus', 'Myliobatis californica', 'Triakis semifasciata'
))
ON CONFLICT (species_id, location_id) DO NOTHING;

/*
# get_categorized_spots_in_bbox RPC

Viewport-envelope discovery query grouped into FishAngler-style categories for
the Global Explorer bottom-sheet dashboard.

Requires: 20260705183000_003_fishing_engine_schema.sql (locations + PostGIS)
*/

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

GRANT EXECUTE ON FUNCTION public.get_categorized_spots_in_bbox(
  double precision,
  double precision,
  double precision,
  double precision
) TO anon, authenticated;

COMMENT ON FUNCTION public.get_categorized_spots_in_bbox IS
  'Viewport bbox categorized water bodies for the Global Explorer Discovery Dashboard.';

-- Verification (should return 8 locations and categorized East Bay JSON)
SELECT count(*)::int AS location_count FROM public.locations;
SELECT public.get_categorized_spots_in_bbox(37.55, 37.75, -122.15, -121.70) AS east_bay_discovery;

/*
# species_availability + get_species_availability_for_location RPC (010)
*/

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

/*
# 011 — nearby spots RPC + post-deploy maintenance
*/

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

GRANT EXECUTE ON FUNCTION public.get_categorized_nearby_spots(
  double precision,
  double precision
) TO anon, authenticated;

UPDATE public.locations l
SET category = public.infer_location_category(l.name, l.water_type)
WHERE l.category IS NULL;

ANALYZE public.locations;

-- Verification
SELECT count(*)::int AS location_count FROM public.locations;
SELECT category, count(*) FROM public.locations GROUP BY 1 ORDER BY 1;
SELECT public.get_categorized_spots_in_bbox(37.55, 37.75, -122.15, -121.70) AS east_bay_discovery;
