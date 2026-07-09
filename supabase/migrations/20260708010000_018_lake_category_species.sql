/*
# Lake category species cleanup

Remove saltwater species from Lakes & Ponds category defaults.
Bulk-imported lakes fall back to this list when no per-location data exists.
*/

DELETE FROM public.species_availability sa
USING public.species s
WHERE sa.species_id = s.id
  AND sa.location_category = 'Lakes & Ponds'
  AND sa.location_id IS NULL
  AND s.scientific_name IN (
    'Paralichthys californicus',
    'Myliobatis californica',
    'Triakis semifasciata'
  );
