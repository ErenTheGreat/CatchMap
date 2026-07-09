#!/usr/bin/env node
/**
 * Execute CA chunks via Supabase Management API (same backend as MCP execute_sql).
 * Reads chunk SQL with fs.readFileSync; marks status via run-ca-chunk-wave-mcp.js.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/run-ca-chunks-mcp-runner.js
 *   node scripts/run-ca-chunks-mcp-runner.js --wave 0
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;
const CHUNK_DIR = path.join(__dirname, '../supabase/scripts/import_batches/_ca_json_chunks');
const OUT_DIR = path.join(__dirname, '../.import/ca_chunks');
const PARALLEL = 4;
const TOTAL = 42;

function markOk(file) {
  spawnSync(process.execPath, [
    path.join(__dirname, 'run-ca-chunk-wave-mcp.js'),
    '--mark-ok',
    '--file',
    file,
  ]);
}

function markFail(file, error) {
  spawnSync(process.execPath, [
    path.join(__dirname, 'run-ca-chunk-wave-mcp.js'),
    '--mark-fail',
    '--file',
    file,
    '--error',
    String(error).slice(0, 500),
  ]);
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
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 400)}`);
  return text;
}

async function runChunk(token, n) {
  const file = `chunk_${String(n).padStart(4, '0')}.sql`;
  const sql = fs.readFileSync(path.join(CHUNK_DIR, file), 'utf8');
  try {
    await postSql(token, sql);
    markOk(file);
    return { n, file, ok: true };
  } catch (e) {
    markFail(file, e.message || e);
    return { n, file, ok: false, error: String(e.message || e) };
  }
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  if (!token) {
    console.error('SUPABASE_ACCESS_TOKEN required');
    process.exit(1);
  }

  const waveArg = process.argv.includes('--wave')
    ? Number(process.argv[process.argv.indexOf('--wave') + 1])
    : null;

  const pending = [];
  if (waveArg != null && !Number.isNaN(waveArg)) {
    const start = waveArg * PARALLEL + 1;
    const end = Math.min(start + PARALLEL - 1, TOTAL);
    for (let n = start; n <= end; n++) pending.push(n);
  } else {
    for (let n = 1; n <= TOTAL; n++) pending.push(n);
  }

  const results = [];
  for (let i = 0; i < pending.length; i += PARALLEL) {
    const wave = pending.slice(i, i + PARALLEL);
    const waveResults = await Promise.all(wave.map((n) => runChunk(token, n)));
    results.push(...waveResults);
    console.log(
      'Wave:',
      waveResults.map((r) => `${r.file}:${r.ok ? 'ok' : 'fail'}`).join(', ')
    );
  }

  if (!waveArg) {
    await postSql(token, 'ANALYZE public.locations;');
    const total = JSON.parse(await postSql(token, 'SELECT count(*)::int AS total FROM public.locations;'))[0]
      .total;
    const ca = JSON.parse(
      await postSql(
        token,
        'SELECT count(*)::int AS n FROM public.locations WHERE ST_Y(coordinates::geometry) BETWEEN 32.5 AND 42.0 AND ST_X(coordinates::geometry) BETWEEN -124.5 AND -114.0;'
      )
    )[0].n;
    const cats = JSON.parse(
      await postSql(token, 'SELECT category, count(*)::int AS n FROM public.locations GROUP BY 1 ORDER BY 1;')
    );
    console.log(JSON.stringify({ total, ca_bbox: ca, categories: cats, results }, null, 2));
  } else {
    console.log(JSON.stringify({ results }, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
