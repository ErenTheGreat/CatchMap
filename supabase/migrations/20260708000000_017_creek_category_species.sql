/*
# Creek category species cleanup

Remove saltwater and estuarine species from Rivers & Creeks category defaults.
Bulk-imported creeks fall back to this list when no per-location data exists.
*/

DELETE FROM public.species_availability sa
USING public.species s
WHERE sa.species_id = s.id
  AND sa.location_category = 'Rivers & Creeks'
  AND sa.location_id IS NULL
  AND s.scientific_name IN (
    'Paralichthys californicus',
    'Myliobatis californica',
    'Triakis semifasciata',
    'Morone saxatilis'
  );

-- Add Green Sunfish to creek category defaults if missing
INSERT INTO public.species_availability (species_id, location_category, month_start, month_end)
SELECT s.id, 'Rivers & Creeks', 4, 10
FROM public.species s
WHERE s.scientific_name = 'Lepomis cyanellus'
  AND NOT EXISTS (
    SELECT 1 FROM public.species_availability sa
    WHERE sa.species_id = s.id
      AND sa.location_category = 'Rivers & Creeks'
      AND sa.location_id IS NULL
  );
