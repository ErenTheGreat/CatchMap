#!/usr/bin/env node
/**
 * Execute all CA combined chunk SQL files via Supabase Management API.
 * Same backend as MCP execute_sql. Reads SQL with fs.readFileSync.
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;
const CHUNK_DIR = path.join(__dirname, '../supabase/scripts/import_batches/_mcp_queue/ca_combined');
const STATUS_IMPORT = path.join(__dirname, '../.import/ca_import_status.json');
const STATUS_CHUNK = path.join(__dirname, '../.import/ca_chunk_status.json');

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

function listChunks() {
  return fs
    .readdirSync(CHUNK_DIR)
    .filter((f) => /^combined_\d+_p\d+\.sql$/.test(f))
    .sort()
    .map((f) => f.replace('.sql', ''));
}

function fileNum(key) {
  return key.replace('combined_', '').replace(/_p\d+$/, '');
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  if (!token) {
    console.error('SUPABASE_ACCESS_TOKEN not set');
    process.exit(1);
  }

  const chunks = listChunks();
  let importStatus = { before: 2778, ok: [], failed: [], errors: [] };
  if (fs.existsSync(STATUS_IMPORT)) {
    importStatus = JSON.parse(fs.readFileSync(STATUS_IMPORT, 'utf8'));
  }

  const before = JSON.parse(
    await postSql(token, 'SELECT count(*)::int AS n FROM public.locations;')
  )[0]?.n;
  importStatus.before = before;
  console.log('Before:', before);

  const chunkStatus = { ok: [], failed: [] };
  const completedFiles = new Set(importStatus.ok);

  for (const key of chunks) {
    const sql = fs.readFileSync(path.join(CHUNK_DIR, `${key}.sql`), 'utf8');
    process.stdout.write(`${key} (${sql.length}b)… `);
    try {
      await postSql(token, sql);
      chunkStatus.ok.push(key);
      console.log('OK');
    } catch (err) {
      chunkStatus.failed.push({ key, error: err.message });
      console.log('FAIL', err.message);
      break;
    }
  }

  fs.mkdirSync(path.dirname(STATUS_CHUNK), { recursive: true });
  fs.writeFileSync(STATUS_CHUNK, JSON.stringify(chunkStatus, null, 2));

  // Mark completed combined files (all 3 parts ok)
  for (let i = 1; i <= 14; i++) {
    const num = String(i).padStart(2, '0');
    const fileKey = `combined_${num}`;
    const parts = [`${fileKey}_p0`, `${fileKey}_p1`, `${fileKey}_p2`];
    if (parts.every((p) => chunkStatus.ok.includes(p)) && !completedFiles.has(fileKey)) {
      importStatus.ok.push(fileKey);
    }
  }

  if (chunkStatus.failed.length) {
    importStatus.failed = chunkStatus.failed.map((f) => ({
      file: fileNum(f.key),
      error: f.error,
    }));
    importStatus.errors = importStatus.failed;
    fs.writeFileSync(STATUS_IMPORT, JSON.stringify(importStatus, null, 2));
    process.exit(1);
  }

  await postSql(token, 'ANALYZE public.locations;');
  const after = JSON.parse(
    await postSql(token, 'SELECT count(*)::int AS n FROM public.locations;')
  )[0]?.n;
  const caCount = JSON.parse(
    await postSql(
      token,
      `SELECT count(*)::int AS n FROM public.locations WHERE ST_Y(coordinates::geometry) BETWEEN 32.5 AND 42 AND ST_X(coordinates::geometry) BETWEEN -124.5 AND -114;`
    )
  )[0]?.n;
  const categories = JSON.parse(
    await postSql(
      token,
      'SELECT category, count(*)::int AS n FROM public.locations GROUP BY 1 ORDER BY 1;'
    )
  );

  importStatus.after = after;
  importStatus.added = after - before;
  fs.writeFileSync(STATUS_IMPORT, JSON.stringify(importStatus, null, 2));

  console.log('\n' + JSON.stringify({ before, after, added: after - before, ca_count: caCount, categories, ok_files: importStatus.ok }, null, 2));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
