#!/usr/bin/env node
/**
 * Import all Great Lakes chunks by reading SQL with Node and calling
 * Supabase Management API (same backend as MCP execute_sql).
 *
 * Set SUPABASE_ACCESS_TOKEN in the environment before running.
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;
const CHUNK_DIR = path.join(__dirname, '_chunks');
const PARALLEL = 4;
const RESULT_FILE = path.join(__dirname, '_great_lakes_import_result.json');

const COUNT_SQL = `SELECT COUNT(*) AS total_locations,
  COUNT(*) FILTER (WHERE ST_Intersects(coordinates, ST_MakeEnvelope(-92.5, 41.0, -76.0, 49.5, 4326)::geography)) AS great_lakes_count
  FROM public.locations;`;

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

async function postSql(token, query) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
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

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  if (!token) {
    console.error('ERROR: Set SUPABASE_ACCESS_TOKEN');
    process.exit(1);
  }

  const chunks = listChunks();
  console.log(`Found ${chunks.length} chunks`);

  const beforeRows = await postSql(token, COUNT_SQL);
  const before = beforeRows[0];
  console.log(`BEFORE: total=${before.total_locations}, great_lakes=${before.great_lakes_count}`);

  const completed = [];
  const errors = [];

  for (let i = 0; i < chunks.length; i += PARALLEL) {
    const wave = chunks.slice(i, i + PARALLEL);
    const waveNum = Math.floor(i / PARALLEL) + 1;
    console.log(`Wave ${waveNum}/${Math.ceil(chunks.length / PARALLEL)}: ${wave.join(', ')}`);

    await Promise.all(
      wave.map(async (name) => {
        const sql = fs.readFileSync(path.join(CHUNK_DIR, name), 'utf8');
        process.stdout.write(`  RUN ${name} (${sql.length}b)... `);
        try {
          await postSql(token, sql);
          completed.push(name);
          console.log('OK');
        } catch (err) {
          errors.push({ name, error: String(err.message || err) });
          console.log('FAIL');
        }
      })
    );
  }

  console.log('Running ANALYZE public.locations;');
  await postSql(token, 'ANALYZE public.locations;');

  const afterRows = await postSql(token, COUNT_SQL);
  const after = afterRows[0];
  console.log(`AFTER: total=${after.total_locations}, great_lakes=${after.great_lakes_count}`);

  const summary = {
    project_id: PROJECT_ID,
    chunks_total: chunks.length,
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
