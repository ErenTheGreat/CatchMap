#!/usr/bin/env node
/**
 * Import all pending mini-chunks via Supabase Management API.
 * Skips keys already in ca_mini_status.json. Marks progress after each chunk.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/mcp-import-all-pending.js
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/mcp-import-all-pending.js --parallel 4
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;
const MINI_DIR = path.join(__dirname, '../.import/mini_chunks');
const MANIFEST = path.join(MINI_DIR, 'manifest.json');
const STATUS = path.join(__dirname, '../.import/ca_mini_status.json');
const RUNNER = path.join(__dirname, 'mcp-mini-chunk-runner.js');

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postSql(token, query, attempt = 0) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (res.status === 429 && attempt < 6) {
    const waitMs = Math.min(30000, 2000 * 2 ** attempt);
    console.error(`rate limited, retry in ${waitMs / 1000}s (attempt ${attempt + 1}/6)`);
    await sleep(waitMs);
    return postSql(token, query, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 400)}`);
  return text;
}

function markOk(key) {
  spawnSync(process.execPath, [RUNNER, '--mark-ok', '--key', key], { stdio: 'pipe' });
}

async function runOne(token, key) {
  const sql = fs.readFileSync(path.join(MINI_DIR, `${key}.sql`), 'utf8');
  await postSql(token, sql);
  markOk(key);
  return key;
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  if (!token) {
    console.error('SUPABASE_ACCESS_TOKEN not set — use MCP execute_sql loop instead');
    process.exit(1);
  }

  const parIdx = process.argv.indexOf('--parallel');
  const parallel = parIdx >= 0 ? Math.max(1, Number(process.argv[parIdx + 1]) || 4) : 1;

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const status = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
  const pending = manifest.mini.map((m) => m.key).sort().filter((k) => !status.ok.includes(k));

  const before = JSON.parse(await postSql(token, 'SELECT count(*)::int AS n FROM public.locations;'))[0]?.n;
  console.log(JSON.stringify({ before, pending: pending.length, parallel }));

  const failed = [];
  for (let i = 0; i < pending.length; i += parallel) {
    const wave = pending.slice(i, i + parallel);
    const results = await Promise.all(
      wave.map((key) =>
        runOne(token, key)
          .then(() => ({ key, ok: true }))
          .catch((e) => {
            failed.push({ key, error: e.message });
            return { key, ok: false, error: e.message };
          })
      )
    );
    console.log(results.map((r) => `${r.key}:${r.ok ? 'ok' : 'fail'}`).join(', '));
    if (failed.length) break;
    await sleep(500);
  }

  if (!failed.length) {
    await postSql(token, 'ANALYZE public.locations;');
    const after = JSON.parse(await postSql(token, 'SELECT count(*)::int AS n FROM public.locations;'))[0]?.n;
    const caCount = JSON.parse(
      await postSql(
        token,
        `SELECT count(*)::int AS n FROM public.locations WHERE ST_Y(coordinates::geometry) BETWEEN 32.5 AND 42 AND ST_X(coordinates::geometry) BETWEEN -124.5 AND -114;`
      )
    )[0]?.n;
    const categories = JSON.parse(
      await postSql(token, 'SELECT category, count(*)::int AS n FROM public.locations GROUP BY 1 ORDER BY 1;')
    );
    spawnSync(process.execPath, [path.join(__dirname, 'mcp-mini-chunk-runner.js'), '--parents-done']);
    console.log(JSON.stringify({ before, after, added: after - before, ca_count: caCount, categories, failed }, null, 2));
  } else {
    console.log(JSON.stringify({ failed }, null, 2));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
