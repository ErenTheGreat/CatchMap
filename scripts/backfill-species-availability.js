#!/usr/bin/env node
/**
 * Backfill species_availability for imported US locations that lack per-location data.
 * Run after migration 022 with: node scripts/backfill-species-availability.js
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and EXPO_PUBLIC_SUPABASE_URL in env.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const LAKE_SPECIES = [
  'Micropterus salmoides',
  'Micropterus dolomieu',
  'Salmo trutta',
  'Oncorhynchus mykiss',
  'Pomoxis nigromaculatus',
  'Lepomis macrochirus',
];

const RIVER_SPECIES = [
  'Micropterus salmoides',
  'Salmo trutta',
  'Oncorhynchus mykiss',
  'Ictalurus punctatus',
  'Esox lucius',
];

const BAY_SPECIES = [
  'Centropomus undecimalis',
  'Sciaenops ocellatus',
  'Megalops atlanticus',
  'Cynoscion nebulosus',
];

const CATEGORY_SPECIES = {
  'Lakes & Ponds': LAKE_SPECIES,
  'Rivers & Creeks': RIVER_SPECIES,
  'Bays & Oceans': BAY_SPECIES,
};

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.method === 'POST' ? 'return=minimal' : 'return=representation',
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${path}: ${response.status} ${text}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function main() {
  console.log('Fetching species catalog...');
  const species = await supabaseFetch('species?select=id,scientific_name');
  const speciesBySci = new Map(species.map((s) => [s.scientific_name, s.id]));

  let inserted = 0;

  for (const [category, scientificNames] of Object.entries(CATEGORY_SPECIES)) {
    const speciesIds = scientificNames
      .map((name) => speciesBySci.get(name))
      .filter(Boolean);

    if (speciesIds.length === 0) {
      console.warn(`No species found for category ${category}, skipping`);
      continue;
    }

    console.log(`Category ${category}: inserting default availability rows`);

    for (const speciesId of speciesIds) {
      const row = {
        species_id: speciesId,
        location_category: category,
        location_id: null,
        month_start: 1,
        month_end: 12,
      };

      try {
        await supabaseFetch('species_availability', {
          method: 'POST',
          body: JSON.stringify(row),
          headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
        });
        inserted += 1;
      } catch (error) {
        if (!String(error.message).includes('duplicate')) {
          console.warn(`Skip ${category}/${speciesId}:`, error.message);
        }
      }
    }
  }

  console.log(`Backfill complete. Attempted ${inserted} category-default rows.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
