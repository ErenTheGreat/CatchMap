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
