#!/usr/bin/env node
/**
 * Import Great Lakes chunk SQL via Supabase Management API (same backend as MCP execute_sql).
 * Reads chunk files with Node, runs in waves of 4 parallel requests.
 *
 * Usage: SUPABASE_ACCESS_TOKEN=... node run_import_mcp.js
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;
const CHUNK_DIR = path.join(__dirname, '_chunks');
const PARALLEL = 4;
const RESULT_FILE = path.join(__dirname, '_great_lakes_import_result.json');

const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
if (!token) {
  console.error('ERROR: Set SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

function listChunks() {
  return fs
    .readdirSync(CHUNK_DIR)
    .filter((f) => /^batch_\d+_chunk_\d+\.sql$/.test(f))
    .sort((a, b) => {
      const pa = a.match(/batch_(\d+)_chunk_(\d+)/);
      const pb = b.match(/batch_(\d+)_chunk_(\d+)/);
      return +pa[1] - +pb[1] || +pa[2] - +pb[2];
    });
}

async function executeSql(query) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return text;
}

async function countQuery(label) {
  const q = `SELECT COUNT(*) AS total_locations,
    COUNT(*) FILTER (WHERE ST_Intersects(coordinates, ST_MakeEnvelope(-92.5, 41.0, -76.0, 49.5, 4326)::geography)) AS great_lakes_count
    FROM public.locations;`;
  const raw = await executeSql(q);
  const parsed = JSON.parse(raw);
  const row = Array.isArray(parsed) ? parsed[0] : parsed;
  console.log(`${label}: total=${row.total_locations}, great_lakes=${row.great_lakes_count}`);
  return row;
}

async function runWave(files, waveIdx) {
  const tasks = files.map(async (name) => {
    const sql = fs.readFileSync(path.join(CHUNK_DIR, name), 'utf8');
    process.stdout.write(`  RUN ${name} (${sql.length} bytes)... `);
    try {
      await executeSql(sql);
      console.log('OK');
      return { name, ok: true };
    } catch (err) {
      console.log('FAIL');
      return { name, ok: false, error: String(err.message || err) };
    }
  });
  return Promise.all(tasks);
}

async function main() {
  const chunks = listChunks();
  console.log(`Found ${chunks.length} chunk files`);

  const before = await countQuery('BEFORE');

  const completed = [];
  const errors = [];

  for (let i = 0; i < chunks.length; i += PARALLEL) {
    const wave = chunks.slice(i, i + PARALLEL);
    const waveNum = Math.floor(i / PARALLEL) + 1;
    console.log(`\nWave ${waveNum}/${Math.ceil(chunks.length / PARALLEL)}: ${wave.join(', ')}`);
    const results = await runWave(wave, waveNum);
    for (const r of results) {
      if (r.ok) completed.push(r.name);
      else errors.push(r);
    }
  }

  console.log('\nRunning ANALYZE public.locations;');
  await executeSql('ANALYZE public.locations;');
  console.log('ANALYZE OK');

  const after = await countQuery('AFTER');

  const summary = {
    project_id: PROJECT_ID,
    chunks_total: chunks.length,
    chunks_ok: completed.length,
    chunks_failed: errors.length,
    before,
    after,
    added_total: Number(after.total_locations) - Number(before.total_locations),
    added_great_lakes: Number(after.great_lakes_count) - Number(before.great_lakes_count),
    errors,
    completed,
  };

  fs.writeFileSync(RESULT_FILE, JSON.stringify(summary, null, 2));
  console.log(`\nResult written to ${RESULT_FILE}`);
  console.log(JSON.stringify(summary, null, 2));

  if (errors.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
