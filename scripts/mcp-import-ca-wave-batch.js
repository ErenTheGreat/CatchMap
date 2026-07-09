#!/usr/bin/env node
/**
 * Batch-import CA chunks 2-42 via Supabase Management API (MCP execute_sql backend).
 * Reads SQL via load-mcp-chunk-args pattern; runs waves of 4 in parallel.
 *
 * Usage: SUPABASE_ACCESS_TOKEN=sbp_... node scripts/mcp-import-ca-wave-batch.js
 *        node scripts/mcp-import-ca-wave-batch.js --from 2 --to 42
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const API = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;
const STATUS_PATH = path.join(__dirname, '../.import/ca_chunks/import_status.json');
const PARALLEL = 4;

function loadQuery(n) {
  const pad = String(n).padStart(4, '0');
  const mcpPath = path.join(__dirname, `../.import/ca_chunks/mcp_${pad}.json`);
  const chunkPath = path.join(
    __dirname,
    '../supabase/scripts/import_batches/_ca_json_chunks',
    `chunk_${pad}.sql`
  );
  if (fs.existsSync(mcpPath)) {
    return JSON.parse(fs.readFileSync(mcpPath, 'utf8')).query;
  }
  return fs.readFileSync(chunkPath, 'utf8');
}

function loadStatus() {
  if (fs.existsSync(STATUS_PATH)) {
    return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
  }
  return { baseline: 2778, ok: [], failed: [], startedAt: new Date().toISOString() };
}

function saveStatus(s) {
  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
  fs.writeFileSync(STATUS_PATH, JSON.stringify(s, null, 2));
}

async function execSql(token, query) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 400)}`);
  return text;
}

async function runChunk(token, n, status) {
  const file = `chunk_${String(n).padStart(4, '0')}.sql`;
  try {
    await execSql(token, loadQuery(n));
    if (!status.ok.includes(file)) status.ok.push(file);
    status.failed = status.failed.filter((f) => f.file !== file);
    saveStatus(status);
    return { n, file, ok: true };
  } catch (e) {
    const err = String(e.message || e).slice(0, 500);
    if (!status.failed.some((f) => f.file === file)) {
      status.failed.push({ file, error: err });
    }
    saveStatus(status);
    return { n, file, ok: false, error: err };
  }
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  if (!token) {
    console.error('SUPABASE_ACCESS_TOKEN not set');
    process.exit(1);
  }

  const fromIdx = process.argv.indexOf('--from');
  const toIdx = process.argv.indexOf('--to');
  const from = fromIdx >= 0 ? Number(process.argv[fromIdx + 1]) : 2;
  const to = toIdx >= 0 ? Number(process.argv[toIdx + 1]) : 42;

  const status = loadStatus();
  const beforeText = await execSql(token, 'SELECT COUNT(*)::int AS total FROM public.locations;');
  const before = JSON.parse(beforeText)[0]?.total ?? status.currentCount ?? 0;
  console.log(JSON.stringify({ before, from, to }));

  const results = [];
  for (let start = from; start <= to; start += PARALLEL) {
    const batch = [];
    for (let n = start; n < start + PARALLEL && n <= to; n++) batch.push(n);
    const waveResults = await Promise.all(batch.map((n) => runChunk(token, n, status)));
    results.push(...waveResults);
    console.log(JSON.stringify({ wave: Math.floor((start - from) / PARALLEL), batch, waveResults }));
  }

  await execSql(token, 'ANALYZE public.locations;');
  const afterText = await execSql(token, 'SELECT COUNT(*)::int AS total FROM public.locations;');
  const after = JSON.parse(afterText)[0]?.total ?? 0;
  const bboxText = await execSql(
    token,
    `SELECT COUNT(*)::int AS n FROM public.locations
     WHERE ST_X(coordinates::geometry) BETWEEN -124.5 AND -114.0
       AND ST_Y(coordinates::geometry) BETWEEN 32.5 AND 42.2;`
  );
  const caBbox = JSON.parse(bboxText)[0]?.n ?? 0;
  const catText = await execSql(
    token,
    'SELECT category, COUNT(*)::int AS n FROM public.locations GROUP BY 1 ORDER BY 1;'
  );
  const categories = {};
  for (const row of JSON.parse(catText)) categories[row.category] = row.n;

  status.partial = false;
  status.completedAt = new Date().toISOString();
  status.beforeCount = before;
  status.currentCount = after;
  status.added = after - before;
  status.caBbox = caBbox;
  status.categories = categories;
  status.note = 'CA chunks 2-42 import complete';
  saveStatus(status);

  console.log(JSON.stringify({ before, after, added: after - before, caBbox, categories, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
