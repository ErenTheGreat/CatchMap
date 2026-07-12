#!/usr/bin/env node
/**
 * Fetch CDFW California named lakes + streams and import into public.locations.
 *
 * Source: CA Water Boards ArcGIS (CDFW named water bodies)
 *   Lakes:   FeatureServer layer 1 — lat_nad83, lon_nad83
 *   Streams: FeatureServer layer 0 — mouth_lat, mouth_long
 *
 * Usage (from project/):
 *   node scripts/import-ca-waterbodies.js
 *
 * Requires SUPABASE_DB_PASSWORD in .env (Dashboard → Settings → Database)
 */

const fs = require('fs');
const path = require('path');

const BASE_URL =
  'https://gispublic.waterboards.ca.gov/portalserver/rest/services/Hosted/All_CA_Named_Streams_and_Lakes/FeatureServer';

const CA_BOUNDS = {
  minLat: 32.5,
  maxLat: 42.0,
  minLng: -124.5,
  maxLng: -114.0,
};

const PAGE_SIZE = 2000;
const INSERT_BATCH = 400;

const SOURCES = [
  {
    layerId: 1,
    category: 'Lake',
    where: `lat_nad83 BETWEEN ${CA_BOUNDS.minLat} AND ${CA_BOUNDS.maxLat} AND lon_nad83 BETWEEN ${CA_BOUNDS.minLng} AND ${CA_BOUNDS.maxLng} AND name IS NOT NULL`,
    outFields: 'name,lat_nad83,lon_nad83',
    map: (attrs) => ({
      name: String(attrs.name).trim(),
      lat: Number(attrs.lat_nad83),
      lng: Number(attrs.lon_nad83),
      category: 'Lake',
    }),
  },
  {
    layerId: 0,
    category: 'Creek',
    where: `mouth_lat BETWEEN ${CA_BOUNDS.minLat} AND ${CA_BOUNDS.maxLat} AND mouth_long BETWEEN ${CA_BOUNDS.minLng} AND ${CA_BOUNDS.maxLng} AND name IS NOT NULL`,
    outFields: 'name,mouth_lat,mouth_long',
    map: (attrs) => ({
      name: String(attrs.name).trim(),
      lat: Number(attrs.mouth_lat),
      lng: Number(attrs.mouth_long),
      category: 'Creek',
    }),
  },
];

function dedupeKey(row) {
  return `${row.name.toLowerCase()}|${row.lat.toFixed(4)}|${row.lng.toFixed(4)}`;
}

async function fetchLayer(source) {
  const rows = [];
  let offset = 0;
  let total = null;

  while (total == null || offset < total) {
    const params = new URLSearchParams({
      where: source.where,
      outFields: source.outFields,
      returnGeometry: 'false',
      f: 'json',
      resultRecordCount: String(PAGE_SIZE),
      resultOffset: String(offset),
    });

    const url = `${BASE_URL}/${source.layerId}/query?${params}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ArcGIS layer ${source.layerId} HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`ArcGIS layer ${source.layerId}: ${data.error.message}`);
    }

    total = data.properties?.count ?? total;
    const features = data.features ?? [];
    if (features.length === 0) break;

    for (const feature of features) {
      const mapped = source.map(feature.attributes ?? {});
      if (
        !mapped.name ||
        !Number.isFinite(mapped.lat) ||
        !Number.isFinite(mapped.lng) ||
        mapped.lat < CA_BOUNDS.minLat ||
        mapped.lat > CA_BOUNDS.maxLat ||
        mapped.lng < CA_BOUNDS.minLng ||
        mapped.lng > CA_BOUNDS.maxLng
      ) {
        continue;
      }
      rows.push(mapped);
    }

    console.log(
      `  layer ${source.layerId} (${source.category}): fetched ${offset + features.length}${total ? ` / ${total}` : ''}`
    );

    offset += features.length;
    if (features.length < PAGE_SIZE) break;
  }

  return rows;
}

function escapeSql(value) {
  return value.replace(/'/g, "''");
}

function buildInsertBatch(batch) {
  const values = batch
    .map((row) => {
      const waterType = row.category === 'Bay' ? 'saltwater' : 'freshwater';
      return `('${escapeSql(row.name)}', '${row.category}', '${waterType}'::public.water_type_enum, ST_SetSRID(ST_MakePoint(${row.lng}, ${row.lat}), 4326)::extensions.geography)`;
    })
    .join(',\n  ');

  return `
INSERT INTO public.locations (name, category, water_type, coordinates)
SELECT v.name, v.category, v.water_type, v.coordinates
FROM (
  VALUES
  ${values}
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
`;
}

async function connectPg(projectRef, password) {
  const { Client } = require('pg');
  const ssl = { rejectUnauthorized: false };
  const candidates = [
    {
      host: 'aws-0-us-east-2.pooler.supabase.com',
      port: 5432,
      user: `postgres.${projectRef}`,
      password,
      database: 'postgres',
      ssl,
    },
    {
      host: 'aws-0-us-east-2.pooler.supabase.com',
      port: 6543,
      user: `postgres.${projectRef}`,
      password,
      database: 'postgres',
      ssl,
    },
    {
      host: `db.${projectRef}.supabase.co`,
      port: 5432,
      user: 'postgres',
      password,
      database: 'postgres',
      ssl,
    },
  ];

  let lastError = null;
  for (const config of candidates) {
    const client = new Client(config);
    try {
      await client.connect();
      console.log(`Connected via ${config.host}`);
      return client;
    } catch (error) {
      lastError = error;
      try {
        await client.end();
      } catch {
        // ignore
      }
    }
  }

  throw lastError ?? new Error('Could not connect to Supabase Postgres');
}

async function main() {
  const projectRoot = path.join(__dirname, '..');
  const envPath = path.join(projectRoot, '.env');
  const env = fs.readFileSync(envPath, 'utf8');
  const urlMatch = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/);
  let password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) {
    const match = env.match(/^SUPABASE_DB_PASSWORD=(.+)$/m);
    if (match) password = match[1].trim().replace(/^["']|["']$/g, '');
  }

  if (!urlMatch || !password) {
    console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in project/.env');
    process.exit(1);
  }

  const projectRef = new URL(urlMatch[1].trim()).hostname.split('.')[0];

  console.log('Fetching California water bodies from CDFW ArcGIS…');
  const combined = [];
  for (const source of SOURCES) {
    const rows = await fetchLayer(source);
    combined.push(...rows);
    console.log(`  → ${rows.length} ${source.category} rows`);
  }

  const deduped = [];
  const seen = new Set();
  for (const row of combined) {
    const key = dedupeKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  console.log(`Deduped ${combined.length} → ${deduped.length} unique rows`);

  const csvPath = path.join(projectRoot, 'data', 'ca_waterbodies.csv');
  const csvLines = ['name,lat,lng,category', ...deduped.map((r) =>
    `"${r.name.replace(/"/g, '""')}",${r.lat},${r.lng},${r.category}`
  )];
  fs.writeFileSync(csvPath, csvLines.join('\n'));
  console.log(`Wrote ${csvPath}`);

  const client = await connectPg(projectRef, password);
  let insertedApprox = 0;

  try {
    for (let i = 0; i < deduped.length; i += INSERT_BATCH) {
      const batch = deduped.slice(i, i + INSERT_BATCH);
      const sql = buildInsertBatch(batch);
      const result = await client.query(sql);
      insertedApprox += result.rowCount ?? 0;
      console.log(
        `Inserted batch ${Math.floor(i / INSERT_BATCH) + 1}/${Math.ceil(deduped.length / INSERT_BATCH)} (+${result.rowCount ?? 0})`
      );
    }

    await client.query('ANALYZE public.locations');

    const { rows } = await client.query(`
      SELECT category, count(*)::int AS n
      FROM public.locations
      GROUP BY 1
      ORDER BY 1
    `);
    const { rows: totalRows } = await client.query('SELECT count(*)::int AS n FROM public.locations');

    console.log('\nImport complete.');
    console.log('Approx new rows this run:', insertedApprox);
    console.log('Totals by category:', rows);
    console.log('Total locations:', totalRows[0]?.n);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Import failed:', error.message);
  process.exit(1);
});
