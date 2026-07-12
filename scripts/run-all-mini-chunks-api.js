#!/usr/bin/env node
/**
 * Execute all mini-chunk SQL files via Supabase Management API.
 * Reads .import/mini_chunks/*.sql (excludes _next_* files).
 * Requires SUPABASE_ACCESS_TOKEN.
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;
const MINI_DIR = path.join(__dirname, '../.import/mini_chunks');
const MANIFEST = path.join(MINI_DIR, 'manifest.json');
const STATUS = path.join(__dirname, '../.import/ca_import_status.json');

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

function listMiniKeys() {
  return fs
    .readdirSync(MINI_DIR)
    .filter((f) => /^combined_\d+_p\d+__m\d+\.sql$/.test(f))
    .map((f) => f.replace('.sql', ''))
    .sort();
}

function parentFile(parentChunk) {
  return parentChunk.replace(/_p\d+$/, '');
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  if (!token) {
    console.error('SUPABASE_ACCESS_TOKEN not set');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const miniStatusPath = path.join(__dirname, '../.import/ca_mini_status.json');
  const miniStatus = fs.existsSync(miniStatusPath)
    ? JSON.parse(fs.readFileSync(miniStatusPath, 'utf8'))
    : { ok: [] };
  const keys = listMiniKeys().filter((k) => !miniStatus.ok.includes(k));
  let status = { before: 2778, ok: [], failed: [], errors: [] };
  if (fs.existsSync(STATUS)) status = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
  if (keys.length === 0) {
    console.log(JSON.stringify({ done: true, note: 'All mini-chunks already imported' }));
    process.exit(0);
  }

  const before = JSON.parse(await postSql(token, 'SELECT count(*)::int AS n FROM public.locations;'))[0]?.n;
  status.before = before;
  console.log('Before:', before);

  const failed = [];
  for (const key of keys) {
    const sql = fs.readFileSync(path.join(MINI_DIR, `${key}.sql`), 'utf8');
    process.stdout.write(`${key} (${sql.length}b)… `);
    try {
      await postSql(token, sql);
      console.log('OK');
    } catch (err) {
      console.log('FAIL', err.message);
      failed.push({ key, error: err.message });
      break;
    }
  }

  if (failed.length) {
    status.failed = failed;
    status.errors = failed;
    fs.writeFileSync(STATUS, JSON.stringify(status, null, 2));
    process.exit(1);
  }

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

  const parents = [...new Set(manifest.mini.map((m) => m.parent))];
  const files = [...new Set(parents.map(parentFile))].sort();

  status.after = after;
  status.added = after - before;
  status.ok = files;
  fs.writeFileSync(STATUS, JSON.stringify(status, null, 2));

  console.log(
    JSON.stringify({ before, after, added: after - before, ca_count: caCount, categories, ok_files: files }, null, 2)
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
