#!/usr/bin/env node
/**
 * Fetch US water bodies from USGS NHD and write regional JSON (+ optional DB import).
 *
 * Usage (from project/):
 *   node scripts/import-us-waterbodies.js --region great_lakes --dry-run
 *   node scripts/import-us-waterbodies.js --region great_lakes
 *   node scripts/import-us-waterbodies.js --region great_lakes --direct-db
 */

const fs = require('fs');
const path = require('path');
const {
  attr,
  dedupeRows,
  fetchNhdLayerTiled,
  mapNhdFlowlineCategory,
  mapNhdWaterbodyCategory,
  polygonCentroid,
  polylineMidpoint,
  buildInsertBatch,
  loadEnv,
  connectPg,
  parseArgs,
} = require('./lib/import-utils');

const INSERT_BATCH = 400;

function loadRegionConfig(projectRoot, regionKey) {
  const configPath = path.join(projectRoot, 'data', 'us', 'regions.json');
  const regions = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const region = regions[regionKey];
  if (!region) {
    throw new Error(`Unknown region "${regionKey}". See data/us/regions.json`);
  }
  return region;
}

function inBBox(lat, lng, bbox) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

async function fetchRegionWaterbodies(region) {
  const bbox = region.bbox;
  const nhd = region.nhd;
  const minLakeArea = region.minLakeAreaSqKm ?? 0.162;
  const minStreamLen = region.minStreamLengthKm ?? 8;
  const tileSpan = region.tileSpanDeg ?? 2;
  const fetchParallel = region.fetchParallel ?? 4;
  const wbFTypes = (nhd.waterbodyFTypes || [390, 436, 466]).join(',');
  const flFTypes = (nhd.flowlineFTypes || [460, 558]).join(',');

  console.log(`Fetching NHD waterbodies (layer ${nhd.waterbodyLayer})…`);
  const lakes = await fetchNhdLayerTiled(
    nhd.waterbodyLayer,
    `GNIS_NAME IS NOT NULL AND GNIS_NAME <> '' AND FTYPE IN (${wbFTypes}) AND AREASQKM >= ${minLakeArea}`,
    bbox,
    'GNIS_NAME,FTYPE,AREASQKM',
    (attrs, geom) => {
      const name = String(attr(attrs, 'GNIS_NAME', 'gnis_name') || '').trim();
      const coords = polygonCentroid(geom.rings);
      if (!name || !coords) return null;
      if (!inBBox(coords.lat, coords.lng, bbox)) return null;
      return {
        name,
        lat: coords.lat,
        lng: coords.lng,
        category: mapNhdWaterbodyCategory(Number(attr(attrs, 'FTYPE', 'ftype'))),
      };
    },
    tileSpan,
    fetchParallel
  );
  console.log(`  → ${lakes.length} lakes/reservoirs`);

  console.log(`Fetching NHD flowlines (layer ${nhd.flowlineLayer})…`);
  const streams = await fetchNhdLayerTiled(
    nhd.flowlineLayer,
    `gnis_name IS NOT NULL AND gnis_name <> '' AND ftype IN (${flFTypes}) AND lengthkm >= ${minStreamLen}`,
    bbox,
    'gnis_name,ftype,lengthkm',
    (attrs, geom) => {
      const name = String(attr(attrs, 'GNIS_NAME', 'gnis_name') || '').trim();
      const coords = polylineMidpoint(geom.paths);
      if (!name || !coords) return null;
      if (!inBBox(coords.lat, coords.lng, bbox)) return null;
      return {
        name,
        lat: coords.lat,
        lng: coords.lng,
        category: mapNhdFlowlineCategory(Number(attr(attrs, 'FTYPE', 'ftype'))),
      };
    },
    tileSpan,
    fetchParallel
  );
  console.log(`  → ${streams.length} streams/rivers`);

  return dedupeRows([...lakes, ...streams]);
}

async function main() {
  const args = parseArgs(process.argv);
  const regionKey = args.options.region;
  if (!regionKey) {
    console.error(
      'Usage: node scripts/import-us-waterbodies.js --region <key> [--dry-run] [--direct-db]'
    );
    process.exit(1);
  }

  const projectRoot = path.join(__dirname, '..');
  const region = loadRegionConfig(projectRoot, regionKey);
  const dryRun = args.flags.has('dry-run');
  const directDb = args.flags.has('direct-db');

  console.log(`Region: ${region.label || regionKey}`);
  console.log(`BBox: ${region.bbox.join(', ')}`);

  const rows = await fetchRegionWaterbodies(region);
  console.log(`Deduped total: ${rows.length} unique rows`);

  const byCategory = rows.reduce((acc, row) => {
    acc[row.category] = (acc[row.category] || 0) + 1;
    return acc;
  }, {});
  console.log('By category:', byCategory);

  const outDir = path.join(projectRoot, 'data', 'us');
  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, `${regionKey}_waterbodies.json`);
  fs.writeFileSync(outJson, JSON.stringify(rows));
  console.log(`Wrote ${outJson}`);

  const csvPath = path.join(outDir, `${regionKey}_waterbodies.csv`);
  const csvLines = [
    'name,lat,lng,category',
    ...rows.map(
      (r) =>
        `"${r.name.replace(/"/g, '""')}",${r.lat},${r.lng},${r.category}`
    ),
  ];
  fs.writeFileSync(csvPath, csvLines.join('\n'));
  console.log(`Wrote ${csvPath}`);

  if (dryRun) {
    console.log('\nDry run — skipping database import.');
    return;
  }

  if (!directDb) {
    console.log('\nJSON ready. Generate SQL batches with:');
    console.log(
      `  node scripts/generate-import-batches.js data/us/${regionKey}_waterbodies.json --out supabase/scripts/import_batches/${regionKey}`
    );
    return;
  }

  const { projectRef, password } = loadEnv(projectRoot);
  if (!password) {
    console.error('Set SUPABASE_DB_PASSWORD in .env for --direct-db');
    process.exit(1);
  }

  const client = await connectPg(projectRef, password);
  let insertedApprox = 0;
  try {
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const batch = rows.slice(i, i + INSERT_BATCH);
      const sql = buildInsertBatch(batch);
      const result = await client.query(sql);
      insertedApprox += result.rowCount ?? 0;
      console.log(
        `Inserted batch ${Math.floor(i / INSERT_BATCH) + 1}/${Math.ceil(rows.length / INSERT_BATCH)} (+${result.rowCount ?? 0})`
      );
    }
    await client.query('ANALYZE public.locations');
    const { rows: totals } = await client.query(
      'SELECT count(*)::int AS n FROM public.locations'
    );
    console.log('\nImport complete. Approx new rows:', insertedApprox);
    console.log('Total locations:', totals[0]?.n);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Import failed:', error.message);
  process.exit(1);
});
