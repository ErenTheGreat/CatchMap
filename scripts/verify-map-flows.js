#!/usr/bin/env node
/**
 * Verify map discovery, search, spot details, and species availability RPCs
 * against live Supabase using the anon key (same path as the mobile app).
 *
 * Usage: node scripts/verify-map-flows.js
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const REGIONS = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, 'data/us/regions.json'), 'utf8')
);

function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, '.env');
  const vars = {};
  if (!fs.existsSync(envPath)) return vars;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return vars;
}

async function rpc(name, body) {
  const env = { ...loadEnv(), ...process.env };
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or ANON_KEY in .env');

  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${name} HTTP ${res.status}: ${String(text).slice(0, 300)}`);
  }
  return data;
}

function bboxAround(lat, lng, span = 0.2) {
  const half = span / 2;
  return [lng - half, lat - half, lng + half, lat + half];
}

function regionCenter(bbox) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}

async function testDiscovery(label, lat, lng, span = 0.2) {
  const [minLng, minLat, maxLng, maxLat] = bboxAround(lat, lng, span);
  const categorized = await rpc('get_categorized_spots_in_bbox', {
    p_min_lat: minLat,
    p_max_lat: maxLat,
    p_min_lng: minLng,
    p_max_lng: maxLng,
  });
  const flat = await rpc('get_locations_in_bbox', {
    min_lng: minLng,
    min_lat: minLat,
    max_lng: maxLng,
    max_lat: maxLat,
  });

  const catSpots = Array.isArray(categorized)
    ? categorized.reduce((n, g) => n + (g.spots?.length ?? 0), 0)
    : 0;

  return {
    label,
    bbox: { minLng, minLat, maxLng, maxLat },
    categorizedGroups: Array.isArray(categorized) ? categorized.length : 0,
    categorizedSpots: catSpots,
    flatSpots: Array.isArray(flat) ? flat.length : 0,
    sample:
      Array.isArray(flat) && flat[0]
        ? { id: flat[0].id, name: flat[0].name, lat: flat[0].latitude, lng: flat[0].longitude }
        : null,
  };
}

async function testSearch(term, expectRegion) {
  const rows = await rpc('search_fishing_spots', { search_term: term });
  const list = Array.isArray(rows) ? rows : [];
  return {
    term,
    expectRegion,
    count: list.length,
    samples: list.slice(0, 3).map((r) => ({ name: r.name, lat: r.latitude, lng: r.longitude })),
  };
}

async function testSpotDetails(spot) {
  if (!spot?.id) return { skipped: true };
  const details = await rpc('get_spot_details', {
    p_latitude: spot.lat,
    p_longitude: spot.lng,
    p_location_id: spot.id,
  });
  return {
    locationId: spot.id,
    name: spot.name,
    speciesCount: details?.species?.length ?? 0,
    catchTimesCount: details?.best_catch_times?.length ?? 0,
  };
}

async function testSpeciesAvailability(spot) {
  if (!spot?.id) return { skipped: true };
  const month = new Date().getMonth() + 1;
  const rows = await rpc('get_species_availability_for_location', {
    p_location_id: spot.id,
    p_month: month,
  });
  const list = Array.isArray(rows) ? rows : [];
  return {
    locationId: spot.id,
    month,
    speciesCount: list.length,
  };
}

async function main() {
  const report = { verifiedAt: new Date().toISOString(), tests: {}, pass: true };

  // CA regression — East Bay (Shadow Cliffs reference area)
  const caDiscovery = await testDiscovery('CA East Bay', 37.669, -121.842);
  report.tests.caDiscovery = caDiscovery;

  // Great Lakes — Lake Michigan (coordinates from search_fishing_spots hit)
  const glDiscovery = await testDiscovery('Great Lakes (Lake MI)', 44.569, -86.895);
  report.tests.greatLakesDiscovery = glDiscovery;

  // Gulf Coast / Texas — Belton Lake area (central TX hill country)
  const txDiscovery = await testDiscovery('Texas (Belton Lake)', 31.186, -97.484);
  report.tests.texasDiscovery = txDiscovery;

  // Northeast — Boston area (plan smoke test)
  const neDiscovery = await testDiscovery('Northeast (Boston)', 42.3, -71.0);
  report.tests.northeastDiscovery = neDiscovery;

  // New nationwide regions — metro smoke tests (wider viewport for sparse areas)
  const denverDiscovery = await testDiscovery('Rocky Mountain (Denver)', 39.74, -104.99, 0.5);
  report.tests.denverDiscovery = denverDiscovery;

  const phoenixDiscovery = await testDiscovery('Intermountain West (Phoenix)', 33.45, -112.07, 0.5);
  report.tests.phoenixDiscovery = phoenixDiscovery;

  const southeastInlandDiscovery = await testDiscovery(
    'Southeast Inland (Central AL lakes)',
    33.28,
    -87.25,
    0.5
  );
  report.tests.southeastInlandDiscovery = southeastInlandDiscovery;
  // Legacy key kept for downstream readers of _verify_map_flows.json
  report.tests.nashvilleDiscovery = southeastInlandDiscovery;

  const okcDiscovery = await testDiscovery('Great Plains (Oklahoma City)', 35.47, -97.52, 0.5);
  report.tests.okcDiscovery = okcDiscovery;

  const slcDiscovery = await testDiscovery('Rocky Mountain (Salt Lake City)', 40.76, -111.89, 0.5);
  report.tests.slcDiscovery = slcDiscovery;

  // Search
  report.tests.searchCA = await testSearch('Shadow', 'CA');
  report.tests.searchGL = await testSearch('Michigan', 'Great Lakes');
  report.tests.searchTX = await testSearch('Belton', 'Texas');
  report.tests.searchNE = await testSearch('Charles', 'Northeast');
  report.tests.searchDenver = await testSearch('Cherry', 'Rocky Mountain');
  report.tests.searchPhoenix = await testSearch('Roosevelt', 'Intermountain West');
  report.tests.searchSoutheastInland = await testSearch('Lake Nicol', 'Southeast Inland');
  report.tests.searchNashville = report.tests.searchSoutheastInland;

  // Spot details + species on first discovered spot per region
  report.tests.caSpotDetails = await testSpotDetails(caDiscovery.sample);
  report.tests.glSpotDetails = await testSpotDetails(glDiscovery.sample);
  report.tests.txSpotDetails = await testSpotDetails(txDiscovery.sample);
  report.tests.neSpotDetails = await testSpotDetails(neDiscovery.sample);
  report.tests.caSpecies = await testSpeciesAvailability(caDiscovery.sample);
  report.tests.glSpecies = await testSpeciesAvailability(glDiscovery.sample);
  report.tests.txSpecies = await testSpeciesAvailability(txDiscovery.sample);
  report.tests.neSpecies = await testSpeciesAvailability(neDiscovery.sample);
  report.tests.denverSpotDetails = await testSpotDetails(denverDiscovery.sample);
  report.tests.phoenixSpotDetails = await testSpotDetails(phoenixDiscovery.sample);
  report.tests.southeastInlandSpotDetails = await testSpotDetails(southeastInlandDiscovery.sample);
  report.tests.nashvilleSpotDetails = report.tests.southeastInlandSpotDetails;
  report.tests.denverSpecies = await testSpeciesAvailability(denverDiscovery.sample);
  report.tests.phoenixSpecies = await testSpeciesAvailability(phoenixDiscovery.sample);

  const checks = [
    ['CA discovery flat spots', caDiscovery.flatSpots > 0],
    ['CA discovery categorized spots', caDiscovery.categorizedSpots > 0],
    ['Great Lakes discovery flat spots', glDiscovery.flatSpots > 0],
    ['Great Lakes discovery categorized spots', glDiscovery.categorizedSpots > 0],
    ['Texas discovery flat spots', txDiscovery.flatSpots > 0],
    ['Texas discovery categorized spots', txDiscovery.categorizedSpots > 0],
    ['Northeast discovery flat spots', neDiscovery.flatSpots > 0],
    ['Northeast discovery categorized spots', neDiscovery.categorizedSpots > 0],
    ['Denver discovery flat spots', denverDiscovery.flatSpots > 0],
    ['Denver discovery categorized spots', denverDiscovery.categorizedSpots > 0],
    ['Phoenix discovery flat spots', phoenixDiscovery.flatSpots > 0],
    ['Phoenix discovery categorized spots', phoenixDiscovery.categorizedSpots > 0],
    ['Southeast Inland discovery flat spots', southeastInlandDiscovery.flatSpots > 0],
    ['Southeast Inland discovery categorized spots', southeastInlandDiscovery.categorizedSpots > 0],
    ['Oklahoma City discovery flat spots', okcDiscovery.flatSpots > 0],
    ['Oklahoma City discovery categorized spots', okcDiscovery.categorizedSpots > 0],
    ['Salt Lake City discovery flat spots', slcDiscovery.flatSpots > 0],
    ['Salt Lake City discovery categorized spots', slcDiscovery.categorizedSpots > 0],
    ['CA search results', report.tests.searchCA.count > 0],
    ['Great Lakes search results', report.tests.searchGL.count > 0],
    ['Texas search results', report.tests.searchTX.count > 0],
    ['Northeast search results', report.tests.searchNE.count > 0],
  ];

  report.checks = checks.map(([name, ok]) => ({ name, ok }));
  report.pass = checks.every(([, ok]) => ok);

  const outPath = path.join(PROJECT_ROOT, 'data/us/_verify_map_flows.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

main().catch((err) => {
  console.error('verify-map-flows failed:', err.message);
  process.exit(1);
});
