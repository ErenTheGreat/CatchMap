/*
# enrich-region cache columns

Supports the enrich-region Edge Function tile-based species caching.
*/

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz;

ALTER TABLE public.species
  ADD COLUMN IF NOT EXISTS gbif_taxon_key bigint;

CREATE UNIQUE INDEX IF NOT EXISTS idx_species_gbif_taxon_key
  ON public.species (gbif_taxon_key)
  WHERE gbif_taxon_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_locations_enriched_at
  ON public.locations (enriched_at DESC NULLS LAST);

COMMENT ON COLUMN public.locations.enriched_at IS
  'When this location tile was last enriched from GBIF via enrich-region.';

COMMENT ON COLUMN public.species.gbif_taxon_key IS
  'GBIF backbone taxon key for deduplication across API versions.';
