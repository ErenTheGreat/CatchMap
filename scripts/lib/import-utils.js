const fs = require('fs');
const path = require('path');

const NHD_BASE =
  'https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer';

function escapeSql(value) {
  return String(value).replace(/'/g, "''");
}

function dedupeKey(row) {
  return `${row.name.toLowerCase()}|${row.lat.toFixed(4)}|${row.lng.toFixed(4)}`;
}

function inferWaterType(category) {
  if (category === 'Bay') return 'saltwater';
  if (category === 'Other') return 'freshwater';
  return 'freshwater';
}

function mapNhdWaterbodyCategory(ftype) {
  if ([390, 436, 466, 378].includes(ftype)) return 'Lake';
  if ([493, 737].includes(ftype)) return 'Bay';
  return 'Lake';
}

function mapNhdFlowlineCategory(ftype) {
  if ([460, 558, 336].includes(ftype)) return 'Creek';
  return 'Creek';
}

function polygonCentroid(rings) {
  if (!rings?.length || !rings[0]?.length) return null;
  const ring = rings[0];
  let sumLat = 0;
  let sumLng = 0;
  let n = 0;
  for (const [lng, lat] of ring) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    sumLat += lat;
    sumLng += lng;
    n += 1;
  }
  if (n === 0) return null;
  return { lat: sumLat / n, lng: sumLng / n };
}

function polylineMidpoint(paths) {
  if (!paths?.length || !paths[0]?.length) return null;
  const path = paths[0];
  const mid = path[Math.floor(path.length / 2)];
  if (!mid || mid.length < 2) return null;
  return { lng: mid[0], lat: mid[1] };
}

function buildInsertBatch(rows) {
  const values = rows
    .map((row) => {
      const waterType = row.waterType || inferWaterType(row.category);
      return `('${escapeSql(row.name)}', '${row.category}', '${waterType}'::public.water_type_enum, ST_SetSRID(ST_MakePoint(${row.lng}, ${row.lat}), 4326)::extensions.geography)`;
    })
    .join(',\n  ');

  return `INSERT INTO public.locations (name, category, water_type, coordinates)
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

function dedupeRows(rows) {
  const deduped = [];
  const seen = new Set();
  for (const row of rows) {
    const key = dedupeKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  return deduped;
}

function loadEnv(projectRoot) {
  const envPath = path.join(projectRoot, '.env');
  const env = fs.readFileSync(envPath, 'utf8');
  const urlMatch = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/);
  let password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) {
    const match = env.match(/^SUPABASE_DB_PASSWORD=(.+)$/m);
    if (match) password = match[1].trim().replace(/^["']|["']$/g, '');
  }
  if (!urlMatch) {
    throw new Error('Set EXPO_PUBLIC_SUPABASE_URL in project/.env');
  }
  const projectRef = new URL(urlMatch[1].trim()).hostname.split('.')[0];
  return { projectRef, password, envPath };
}

async function connectPg(projectRef, password) {
  const { Client } = require('pg');
  const ssl = { rejectUnauthorized: false };
  const candidates = [
    {
      host: 'aws-0-us-west-1.pooler.supabase.com',
      port: 5432,
      user: `postgres.${projectRef}`,
      password,
      database: 'postgres',
      ssl,
    },
    {
      host: 'aws-0-us-east-2.pooler.supabase.com',
      port: 5432,
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

function attr(attrs, ...keys) {
  for (const key of keys) {
    if (attrs[key] != null && attrs[key] !== '') return attrs[key];
    const lower = key.toLowerCase();
    if (attrs[lower] != null && attrs[lower] !== '') return attrs[lower];
    const upper = key.toUpperCase();
    if (attrs[upper] != null && attrs[upper] !== '') return attrs[upper];
  }
  return null;
}

function tileBboxes(bbox, spanDeg = 2) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const tiles = [];
  for (let lat = minLat; lat < maxLat; lat += spanDeg) {
    for (let lng = minLng; lng < maxLng; lng += spanDeg) {
      tiles.push([
        lng,
        lat,
        Math.min(lng + spanDeg, maxLng),
        Math.min(lat + spanDeg, maxLat),
      ]);
    }
  }
  return tiles;
}

function bboxToGeometry(bbox) {
  return `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`;
}

async function fetchNhdLayer(layerId, where, geometry, outFields, mapFn) {
  const rows = [];
  const PAGE_SIZE = 500;
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      where,
      geometry,
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      outFields,
      returnGeometry: 'true',
      outSR: '4326',
      resultRecordCount: String(PAGE_SIZE),
      resultOffset: String(offset),
      f: 'json',
    });

    const url = `${NHD_BASE}/${layerId}/query?${params}`;
    let data;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`NHD layer ${layerId} HTTP ${response.status}`);
      }
      data = await response.json();
      if (!data.error) break;
      if (attempt === 2) {
        throw new Error(`NHD layer ${layerId}: ${data.error.message}`);
      }
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }

    const features = data.features ?? [];
    if (features.length === 0) break;

    for (const feature of features) {
      const mapped = mapFn(feature.attributes ?? {}, feature.geometry ?? {});
      if (mapped) rows.push(mapped);
    }

    offset += features.length;
    if (features.length < PAGE_SIZE) break;
  }

  return rows;
}

async function fetchNhdLayerTiled(layerId, where, bbox, outFields, mapFn, spanDeg = 1, parallel = 4) {
  async function fetchTile(tile, depth = 0) {
    const [minLng, minLat, maxLng, maxLat] = tile;
    const span = Math.max(maxLng - minLng, maxLat - minLat);
    try {
      return await fetchNhdLayer(
        layerId,
        where,
        bboxToGeometry(tile),
        outFields,
        mapFn
      );
    } catch (error) {
      if (span <= 0.25 || depth >= 5) {
        console.warn(`    skip tile [${tile.join(', ')}]: ${error.message}`);
        return [];
      }
      const midLng = (minLng + maxLng) / 2;
      const midLat = (minLat + maxLat) / 2;
      const quads = [
        [minLng, minLat, midLng, midLat],
        [midLng, minLat, maxLng, midLat],
        [minLng, midLat, midLng, maxLat],
        [midLng, midLat, maxLng, maxLat],
      ];
      const nested = [];
      for (const quad of quads) {
        nested.push(...(await fetchTile(quad, depth + 1)));
      }
      return nested;
    }
  }

  const tiles = tileBboxes(bbox, spanDeg);
  const rows = [];
  for (let i = 0; i < tiles.length; i += parallel) {
    const wave = tiles.slice(i, i + parallel);
    const waveResults = await Promise.all(
      wave.map(async (tile, j) => {
        const idx = i + j + 1;
        process.stdout.write(`  tile ${idx}/${tiles.length} [${tile.join(', ')}]… `);
        const tileRows = await fetchTile(tile);
        console.log(`${tileRows.length} rows`);
        return tileRows;
      })
    );
    for (const tileRows of waveResults) {
      rows.push(...tileRows);
    }
  }
  return rows;
}

function parseArgs(argv) {
  const args = { flags: new Set(), options: {} };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args.options[key] = next;
        i += 1;
      } else {
        args.flags.add(key);
      }
    } else {
      args.options._ = args.options._ || [];
      args.options._.push(arg);
    }
  }
  return args;
}

module.exports = {
  NHD_BASE,
  escapeSql,
  dedupeKey,
  dedupeRows,
  inferWaterType,
  mapNhdWaterbodyCategory,
  mapNhdFlowlineCategory,
  polygonCentroid,
  polylineMidpoint,
  buildInsertBatch,
  loadEnv,
  connectPg,
  attr,
  tileBboxes,
  bboxToGeometry,
  fetchNhdLayer,
  fetchNhdLayerTiled,
  parseArgs,
};
