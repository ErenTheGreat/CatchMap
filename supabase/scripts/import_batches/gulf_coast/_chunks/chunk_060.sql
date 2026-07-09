INSERT INTO public.locations (name, category, water_type, coordinates)
SELECT v.name, v.category, v.water_type, v.coordinates
FROM (
  VALUES
  ('Santee River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-80.5160024457581, 33.595334018866374), 4326)::extensions.geography),
  ('Edisto River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-80.709924082998, 33.1566984491955), 4326)::extensions.geography),
  ('Edisto River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-80.43772679784823, 33.053375235590906), 4326)::extensions.geography),
  ('Santee River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-80.0327110989796, 33.50308734817061), 4326)::extensions.geography),
  ('Black River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-80.1061907359547, 33.81123748064862), 4326)::extensions.geography),
  ('Coldwater Branch', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-80.42318673056194, 33.138923521379766), 4326)::extensions.geography),
  ('Washita River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-97.19105144073134, 34.6565117459529), 4326)::extensions.geography),
  ('Washita River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-96.61496779284936, 34.14739828052801), 4326)::extensions.geography),
  ('Hampton Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-95.73637604840081, 34.33931295707618), 4326)::extensions.geography),
  ('Caney Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-95.6678348433502, 34.514130126327835), 4326)::extensions.geography),
  ('Wildcat Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-95.56622501365442, 34.48433132553327), 4326)::extensions.geography),
  ('Cole Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-95.67510058218988, 34.58648973892175), 4326)::extensions.geography),
  ('Pine Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-95.57564081695423, 34.48932399275537), 4326)::extensions.geography),
  ('Fobb Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-95.68473798382172, 34.57210280300741), 4326)::extensions.geography),
  ('Tombstone Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-94.93099639366103, 34.6300716493491), 4326)::extensions.geography),
  ('Cow Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-94.46758853643543, 34.57390585958936), 4326)::extensions.geography),
  ('Long Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-95.12015363970879, 34.59891936773598), 4326)::extensions.geography),
  ('Cripple Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-95.23145632940958, 34.51015574560105), 4326)::extensions.geography),
  ('Freedom Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-93.82709799294874, 34.94540655929707), 4326)::extensions.geography),
  ('Muddy Fork', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-93.93732750413052, 34.182145410175124), 4326)::extensions.geography),
  ('Dry Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-94.40151711027589, 34.44431377226772), 4326)::extensions.geography),
  ('Mud Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-92.63365856505355, 34.27226848558975), 4326)::extensions.geography),
  ('Arkansas River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-91.91387743902025, 34.27024645062221), 4326)::extensions.geography),
  ('Indian Bayou', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-91.90282391972295, 34.52528230008602), 4326)::extensions.geography),
  ('Wabbaseka Bayou', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-91.74052999770325, 34.3335162700818), 4326)::extensions.geography),
  ('Arkansas River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-91.57967360545459, 34.09240143043278), 4326)::extensions.geography),
  ('Wattensaw Bayou', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-91.48962463126723, 34.86654965141555), 4326)::extensions.geography),
  ('East Branch Flat Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-92.44092397715461, 34.221029284377316), 4326)::extensions.geography),
  ('Bakers Bayou', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-91.97486728597295, 34.725437936122624), 4326)::extensions.geography),
  ('Essex Bayou', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-91.13355802546887, 34.210445672299365), 4326)::extensions.geography),
  ('Arkansas River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-91.43574769578545, 34.02977369080546), 4326)::extensions.geography),
  ('Indian Bay', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-91.06975561968034, 34.38302930910173), 4326)::extensions.geography),
  ('White River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-91.39700099861986, 34.758229767953274), 4326)::extensions.geography),
  ('White River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-91.314534770234, 34.65617275206333), 4326)::extensions.geography),
  ('Mississippi River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-90.57952899720775, 34.44247652308299), 4326)::extensions.geography),
  ('Cache River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-91.37062940071407, 34.894535862259744), 4326)::extensions.geography),
  ('White River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-91.28836149183692, 34.58185633824515), 4326)::extensions.geography),
  ('Walnut Bayou', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-90.40952182354992, 34.10498832758469), 4326)::extensions.geography),
  ('Town Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-85.98626525494205, 34.0457333167241), 4326)::extensions.geography),
  ('Long Branch', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-85.40198333554036, 34.8663008438009), 4326)::extensions.geography),
  ('Wateree River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-80.63269584374581, 34.188376744752006), 4326)::extensions.geography),
  ('Frees Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-81.3141813190649, 34.34138915444102), 4326)::extensions.geography),
  ('Lynches River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-80.21181332305356, 34.260093574559654), 4326)::extensions.geography)
) AS v(name, category, water_type, coordinates)
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
