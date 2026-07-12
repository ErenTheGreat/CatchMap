#!/usr/bin/env node
/**
 * Import Gulf Coast batch SQL via Supabase Management API (same backend as MCP execute_sql).
 * Usage: SUPABASE_ACCESS_TOKEN=... node scripts/gulf-coast-import-mcp-api.js
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;
const BATCH_DIR = path.join(__dirname, '../.import/mcp_run/gulf_coast');
const PARALLEL = 3;
const RESULT_FILE = path.join(BATCH_DIR, '_gulf_coast_import_result.json');

const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
if (!token) {
  console.error('ERROR: Set SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function listBatches() {
  return fs
    .readdirSync(BATCH_DIR)
    .filter((f) => /^batch_\d{3}\.sql$/.test(f))
    .sort();
}

async function executeSql(query, attempt = 0) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (res.status === 429 && attempt < 6) {
    const waitMs = Math.min(30000, 2000 * 2 ** attempt);
    console.error(`rate limited, retry in ${waitMs / 1000}s (attempt ${attempt + 1})`);
    await sleep(waitMs);
    return executeSql(query, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  return text;
}

async function countGulfCoast(label) {
  const q = `SELECT count(*)::int AS total,
    count(*) FILTER (WHERE ST_Intersects(coordinates, ST_MakeEnvelope(-97.5, 24, -80, 35, 4326)::geography)) AS gulf_coast
    FROM public.locations;`;
  const raw = await executeSql(q);
  const row = JSON.parse(raw)[0];
  console.log(`${label}: total=${row.total}, gulf_coast=${row.gulf_coast}`);
  return row;
}

async function main() {
  const files = listBatches();
  console.log(`Found ${files.length} batch files`);

  const before = await countGulfCoast('Before');
  const results = [];

  for (let i = 0; i < files.length; i += PARALLEL) {
    const wave = files.slice(i, i + PARALLEL);
    console.log(`Wave ${Math.floor(i / PARALLEL) + 1}: ${wave.join(', ')}`);
    const waveResults = await Promise.all(
      wave.map(async (file) => {
        const sql = fs.readFileSync(path.join(BATCH_DIR, file), 'utf8');
        process.stdout.write(`  ${file} (${sql.length} bytes)... `);
        try {
          await executeSql(sql);
          console.log('OK');
          return { file, ok: true };
        } catch (err) {
          console.log('FAIL');
          return { file, ok: false, error: String(err.message || err) };
        }
      })
    );
    results.push(...waveResults);
  }

  await executeSql('ANALYZE public.locations;');
  console.log('ANALYZE public.locations OK');

  const after = await countGulfCoast('After');
  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  const summary = {
    batches_total: files.length,
    batches_succeeded: succeeded,
    batches_failed: failed.length,
    gulf_coast_before: before.gulf_coast,
    gulf_coast_after: after.gulf_coast,
    gulf_coast_delta: after.gulf_coast - before.gulf_coast,
    before,
    after,
    failed,
  };

  fs.writeFileSync(RESULT_FILE, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
