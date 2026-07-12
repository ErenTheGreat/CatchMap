/*
# Create catches table

1. New Tables
- `catches`
- `id` (uuid, primary key)
- `species` (text, not null) - Name of fish species
- `species_id` (text) - Reference to species data
- `weight` (text, not null) - Weight of fish caught
- `lure` (text) - Lure used
- `notes` (text) - Additional notes
- `latitude` (decimal) - Location latitude
- `longitude` (decimal) - Location longitude
- `caught_at` (timestamp) - When the fish was caught
- `created_at` (timestamp)

2. Security
- Enable RLS on `catches`.
- Allow anon + authenticated CRUD (single-tenant, no auth).
*/

CREATE TABLE IF NOT EXISTS catches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  species text NOT NULL,
  species_id text,
  weight text NOT NULL,
  lure text,
  notes text,
  latitude decimal(10, 7),
  longitude decimal(10, 7),
  caught_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE catches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_catches" ON catches;
CREATE POLICY "anon_select_catches" ON catches FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_catches" ON catches;
CREATE POLICY "anon_insert_catches" ON catches FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_catches" ON catches;
CREATE POLICY "anon_update_catches" ON catches FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_catches" ON catches;
CREATE POLICY "anon_delete_catches" ON catches FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_catches_caught_at ON catches(caught_at DESC);
