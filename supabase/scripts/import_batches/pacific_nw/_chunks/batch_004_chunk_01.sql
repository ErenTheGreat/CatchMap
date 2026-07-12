INSERT INTO public.locations (name, category, water_type, coordinates)
SELECT v.name, v.category, v.water_type, v.coordinates
FROM (
  VALUES
  ('Riddle Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-120.66952949561265, 48.23780042574062), 4326)::extensions.geography),
  ('Rock Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-120.76551053559278, 48.06550873889844), 4326)::extensions.geography),
  ('Pack River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-116.45898057152938, 48.3864676935801), 4326)::extensions.geography),
  ('Hoodoo Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-116.79502202949644, 48.08306763688132), 4326)::extensions.geography),
  ('Upper West Branch Priest River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-116.95470267988549, 48.44496737719772), 4326)::extensions.geography),
  ('Sumas River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-122.21261133366397, 49.03334840169487), 4326)::extensions.geography),
  ('East Branch Kootenay River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-116.65695730861631, 49.223342914698165), 4326)::extensions.geography)) AS v(name, category, water_type, coordinates)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.locations l
  WHERE lower(trim(l.name)) = lower(trim(v.name))
    AND ST_DWithin(
      l.coordinates,
      v.coordinates,
      250
    )
);
