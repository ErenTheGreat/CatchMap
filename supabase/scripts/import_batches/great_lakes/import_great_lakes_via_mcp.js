#!/usr/bin/env node
/**
 * Import all Great Lakes chunks via Supabase MCP (execute_sql equivalent).
 * Node reads each chunk SQL from _mcp_exec/queries/*.query.json and POSTs to
 * Supabase Management API (same backend as plugin-supabase-supabase execute_sql).
 *
 * Auth: SUPABASE_ACCESS_TOKEN env var, or pass token file path as first arg.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node import_great_lakes_via_mcp.js
 *   node import_great_lakes_via_mcp.js /path/to/token.txt
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;
const QUERIES_DIR = path.join(__dirname, '_mcp_exec/queries');
const PARALLEL = 4;
const RESULT_FILE = path.join(__dirname, '_great_lakes_import_result.json');

const COUNT_SQL = `SELECT COUNT(*) AS total_locations,
  COUNT(*) FILTER (WHERE ST_Intersects(coordinates, ST_MakeEnvelope(-92.5, 41.0, -76.0, 49.5, 4326)::geography)) AS great_lakes_count
  FROM public.locations;`;

function token() {
  if (process.argv[2] && fs.existsSync(process.argv[2])) {
    return fs.readFileSync(process.argv[2], 'utf8').trim();
  }
  return process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
}

async function postSql(auth, query) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function queryFiles() {
  return fs
    .readdirSync(QUERIES_DIR)
    .filter((f) => f.endsWith('.query.json'))
    .sort((a, b) => {
      const pa = a.match(/batch_(\d+)_chunk_(\d+)/);
      const pb = b.match(/batch_(\d+)_chunk_(\d+)/);
      return +pa[1] - +pb[1] || +pa[2] - +pb[2];
    });
}

async function main() {
  const auth = token();
  if (!auth) {
    console.error('ERROR: Set SUPABASE_ACCESS_TOKEN or pass token file path');
    process.exit(1);
  }

  const files = queryFiles();
  console.log(`Importing ${files.length} chunks (waves of ${PARALLEL})`);

  const beforeRows = await postSql(auth, COUNT_SQL);
  const before = beforeRows[0];
  console.log(`BEFORE: total=${before.total_locations}, great_lakes=${before.great_lakes_count}`);

  const completed = [];
  const errors = [];

  for (let i = 0; i < files.length; i += PARALLEL) {
    const wave = files.slice(i, i + PARALLEL);
    const waveNum = Math.floor(i / PARALLEL) + 1;
    console.log(`\nWave ${waveNum}/${Math.ceil(files.length / PARALLEL)}`);

    await Promise.all(
      wave.map(async (file) => {
        const name = file.replace('.query.json', '');
        const query = JSON.parse(fs.readFileSync(path.join(QUERIES_DIR, file), 'utf8'));
        process.stdout.write(`  RUN ${name} (${query.length}b)... `);
        try {
          await postSql(auth, query);
          completed.push(name);
          console.log('OK');
        } catch (err) {
          errors.push({ name, error: String(err.message || err) });
          console.log('FAIL');
        }
      })
    );
  }

  console.log('\nANALYZE public.locations;');
  await postSql(auth, 'ANALYZE public.locations;');

  const afterRows = await postSql(auth, COUNT_SQL);
  const after = afterRows[0];
  console.log(`AFTER: total=${after.total_locations}, great_lakes=${after.great_lakes_count}`);

  const summary = {
    project_id: PROJECT_ID,
    chunks_total: files.length,
    chunks_ok: completed.length,
    chunks_failed: errors.length,
    before,
    after,
    added_total: Number(after.total_locations) - Number(before.total_locations),
    added_great_lakes: Number(after.great_lakes_count) - Number(before.great_lakes_count),
    completed,
    errors,
  };

  fs.writeFileSync(RESULT_FILE, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (errors.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
