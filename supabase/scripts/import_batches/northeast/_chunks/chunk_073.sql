INSERT INTO public.locations (name, category, water_type, coordinates)
SELECT v.name, v.category, v.water_type, v.coordinates
FROM (
  VALUES
  ('Little Stony Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-76.17070448688226, 43.815706286583605), 4326)::extensions.geography),
  ('Eightmile Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-76.5826702536742, 43.387293060294894), 4326)::extensions.geography),
  ('Taylor Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-76.07929038847182, 43.77797975100478), 4326)::extensions.geography),
  ('Hurlbut Glen Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-75.37835925631187, 43.272954022002246), 4326)::extensions.geography),
  ('Ava Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-75.48067943245407, 43.401716108013304), 4326)::extensions.geography),
  ('Long Lake Outlet', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-75.21628221900583, 43.51809228388594), 4326)::extensions.geography),
  ('Stebbins Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-75.74571922446007, 43.91876278916544), 4326)::extensions.geography),
  ('Mill Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-75.94850223734825, 43.92330282449214), 4326)::extensions.geography),
  ('Mill Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-75.36145785873454, 43.46432163188172), 4326)::extensions.geography),
  ('Wood Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-75.45790409226433, 43.41570324410936), 4326)::extensions.geography),
  ('Luther Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-75.71871219022086, 43.7282007222112), 4326)::extensions.geography),
  ('Negro Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-75.53613811882016, 43.85116976040511), 4326)::extensions.geography),
  ('Vaughn Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-75.2636310147164, 43.21572948232067), 4326)::extensions.geography),
  ('Mulligan Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-75.66835913083942, 43.72377973844103), 4326)::extensions.geography),
  ('Raystone Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-75.92850720256656, 43.72814574796709), 4326)::extensions.geography),
  ('Mill Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-74.19597161834672, 43.447152298465014), 4326)::extensions.geography),
  ('Zimmerman Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-74.63826380040113, 43.035161673845856), 4326)::extensions.geography),
  ('Middle Sprite Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-74.67321581628859, 43.11442722102065), 4326)::extensions.geography),
  ('Mossy Vly Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-74.4735771146033, 43.52036996816503), 4326)::extensions.geography),
  ('Mousam River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-70.56855315786565, 43.4018012839143), 4326)::extensions.geography),
  ('Royal River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-70.2615856901188, 43.9744395977984), 4326)::extensions.geography),
  ('Willow Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-79.7542930758525, 44.456341706639684), 4326)::extensions.geography),
  ('Plato Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-77.84934615931054, 44.4361718916154), 4326)::extensions.geography),
  ('Beaver Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-75.38048810012467, 44.55133887424482), 4326)::extensions.geography),
  ('Black Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-75.60521959714036, 44.07837918674412), 4326)::extensions.geography),
  ('Squeak Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-74.83760099803841, 44.818544983739855), 4326)::extensions.geography),
  ('Saint Lawrence River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-74.87693513275144, 45.00187961617467), 4326)::extensions.geography),
  ('Hatch Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-74.18905775163662, 44.671681954164235), 4326)::extensions.geography),
  ('Mill Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-73.55069051736318, 44.0527288984274), 4326)::extensions.geography),
  ('Pettigrew Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-73.80584296214167, 44.43132528879189), 4326)::extensions.geography),
  ('Little Alder Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-70.06805062369078, 45.02389372394078), 4326)::extensions.geography),
  ('Old Course Saco River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-70.9679422667072, 44.11473273381733), 4326)::extensions.geography),
  ('Great Works Stream', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-68.564529975244, 44.88203554485468), 4326)::extensions.geography),
  ('Décharge des Vingt', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-73.09308810232555, 45.85664043365748), 4326)::extensions.geography),
  ('Pollard Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-68.66234002608633, 45.183358928462134), 4326)::extensions.geography),
  ('Scutaze Stream', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-68.8393754939618, 45.319443079964564), 4326)::extensions.geography),
  ('East Branch Penobscot River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-68.5895061673106, 45.729586959027316), 4326)::extensions.geography),
  ('Little Meadow Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-68.04434377251529, 45.58159394897818), 4326)::extensions.geography),
  ('Meadow Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-68.01291982607958, 45.54642067779001), 4326)::extensions.geography),
  ('Big La Coote Stream', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-67.49521278577619, 45.686876086676484), 4326)::extensions.geography),
  ('Four Mile Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-67.44121038064166, 45.93755973125865), 4326)::extensions.geography),
  ('Beaver Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-67.65856843732095, 45.527493284136206), 4326)::extensions.geography),
  ('North Crooked Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-67.77103674552752, 45.58598315773467), 4326)::extensions.geography),
  ('Regiment Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-66.73615384080291, 45.99337496147199), 4326)::extensions.geography),
  ('Dowdall Meadow Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-66.89189085645259, 45.256005226773986), 4326)::extensions.geography),
  ('Muskie Creek', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-79.66125461565603, 46.184813499761), 4326)::extensions.geography),
  ('Sweeney Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-69.66569565208012, 46.54273826463036), 4326)::extensions.geography),
  ('Mills Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-69.63767437828078, 46.56011400082398), 4326)::extensions.geography),
  ('Southwest Branch Saint John River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-69.94576354568063, 46.49968044758605), 4326)::extensions.geography),
  ('Scopan Stream', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-68.26747590553016, 46.526057037647554), 4326)::extensions.geography),
  ('Alder Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-68.30180408807716, 46.06478062450878), 4326)::extensions.geography),
  ('Smith Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-68.89850531902195, 46.47641380982372), 4326)::extensions.geography),
  ('Mill Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-67.080259665029, 46.091790668521035), 4326)::extensions.geography),
  ('South Branch Twomile Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-69.5271539712936, 47.03167215001351), 4326)::extensions.geography),
  ('East Branch Pocwock Stream', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-69.34811171734759, 47.142778573682335), 4326)::extensions.geography),
  ('Little Madawaska River', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-68.11892215080451, 47.01587632390806), 4326)::extensions.geography),
  ('Black Brook', 'Creek', 'freshwater'::public.water_type_enum, ST_SetSRID(ST_MakePoint(-68.77051791043179, 47.02680637298445), 4326)::extensions.geography)
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
