#!/usr/bin/env node
/**
 * Resume mini-chunk import via Management API, skipping keys already in ca_mini_status.json.
 * Requires SUPABASE_ACCESS_TOKEN.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/mcp-execute-pending-resume.js
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/mcp-execute-pending-resume.js --limit 20
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

async function postSql(token, query) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 400)}`);
  return text;
}

function markOk(key) {
  spawnSync(process.execPath, [RUNNER, '--mark-ok', '--key', key], { stdio: 'inherit' });
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  if (!token) {
    console.error('SUPABASE_ACCESS_TOKEN not set');
    process.exit(1);
  }

  const limitIdx = process.argv.indexOf('--limit');
  const limit = limitIdx >= 0 ? Number(process.argv[limitIdx + 1]) : Infinity;

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const status = fs.existsSync(STATUS)
    ? JSON.parse(fs.readFileSync(STATUS, 'utf8'))
    : { before: 2778, ok: [], failed: [], errors: [] };

  const allKeys = manifest.mini.map((m) => m.key).sort();
  const pending = allKeys.filter((k) => !status.ok.includes(k));
  const batch = pending.slice(0, limit);

  console.log(`Pending: ${pending.length}, running: ${batch.length}`);

  const before = JSON.parse(await postSql(token, 'SELECT count(*)::int AS n FROM public.locations;'))[0]?.n;
  console.log('Before:', before);

  const failed = [];
  for (const key of batch) {
    const sql = fs.readFileSync(path.join(MINI_DIR, `${key}.sql`), 'utf8');
    process.stdout.write(`${key} (${sql.length}b)… `);
    try {
      await postSql(token, sql);
      markOk(key);
      console.log('OK');
    } catch (err) {
      console.log('FAIL', err.message);
      failed.push({ key, error: err.message });
      break;
    }
  }

  const after = JSON.parse(await postSql(token, 'SELECT count(*)::int AS n FROM public.locations;'))[0]?.n;
  console.log(JSON.stringify({ before, after, added: after - before, done: batch.length - failed.length, failed }, null, 2));

  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
