#!/usr/bin/env node
/**
 * Import waterbody JSON via Supabase REST RPC (import_waterbodies_batch).
 * Requires import_waterbodies_batch() deployed via MCP execute_sql first.
 *
 * Usage:
 *   node scripts/import-json-via-rpc.js data/us/gulf_coast_waterbodies.json
 *   node scripts/import-json-via-rpc.js data/us/northeast_waterbodies.json
 */
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/import-utils');

const BATCH = 200;

function readEnv(projectRoot) {
  const envPath = path.join(projectRoot, '.env');
  const vars = {};
  if (!fs.existsSync(envPath)) return vars;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return vars;
}

async function rpc(url, key, fn, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${fn} HTTP ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

async function countRegions(url, key) {
  const query = `SELECT count(*)::int AS total,
    count(*) FILTER (WHERE ST_Intersects(coordinates, ST_MakeEnvelope(-97.5, 24, -80, 35, 4326)::geography)) AS gulf_coast,
    count(*) FILTER (WHERE ST_Intersects(coordinates, ST_MakeEnvelope(-80, 36, -66, 47.5, 4326)::geography)) AS northeast
    FROM public.locations`;
  const res = await fetch(`${url}/rest/v1/rpc/import_waterbodies_batch`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: [] }),
  });
  // count via raw sql not available on anon — skip
  return null;
}

async function main() {
  const args = parseArgs(process.argv);
  const inputPath = args.options._?.[0];
  if (!inputPath) {
    console.error('Usage: node scripts/import-json-via-rpc.js <json-path>');
    process.exit(1);
  }

  const projectRoot = path.join(__dirname, '..');
  const absInput = path.isAbsolute(inputPath) ? inputPath : path.join(projectRoot, inputPath);
  const rows = JSON.parse(fs.readFileSync(absInput, 'utf8'));
  const env = readEnv(projectRoot);
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL or ANON_KEY');
    process.exit(1);
  }

  console.log(`Importing ${rows.length} rows from ${absInput}`);
  let insertedApprox = 0;
  const batches = Math.ceil(rows.length / BATCH);

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const n = Math.floor(i / BATCH) + 1;
    process.stdout.write(`Batch ${n}/${batches} (${batch.length} rows)… `);
    try {
      const result = await rpc(url, key, 'import_waterbodies_batch', { rows: batch });
      const count = typeof result === 'number' ? result : result?.[0] ?? 0;
      insertedApprox += Number(count) || 0;
      console.log(`+${count}`);
    } catch (e) {
      console.log('FAIL');
      throw e;
    }
  }

  console.log(`\nDone. Approx inserted: ${insertedApprox}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
