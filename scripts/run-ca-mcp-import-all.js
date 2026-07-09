#!/usr/bin/env node
/**
 * Execute all CA combined chunks via Supabase Management API.
 * Falls back to printing MCP payloads when no token is set.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/run-ca-mcp-import-all.js
 *   node scripts/run-ca-mcp-import-all.js --dry-run
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;
const CHUNK_DIR = path.join(__dirname, '../supabase/scripts/import_batches/_mcp_queue/ca_combined');
const STATUS_PATH = path.join(__dirname, '../.import/ca_import_status.json');
const PARALLEL = 4;

function listChunks() {
  return fs
    .readdirSync(CHUNK_DIR)
    .filter((f) => /^combined_\d+_p\d+\.sql$/.test(f))
    .sort()
    .map((f) => f.replace('.sql', ''));
}

function loadStatus() {
  if (!fs.existsSync(STATUS_PATH)) {
    return { before: 2778, ok: [], failed: [], errors: [], chunks_ok: [] };
  }
  return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
}

function saveStatus(s) {
  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
  fs.writeFileSync(STATUS_PATH, JSON.stringify(s, null, 2));
}

async function postSql(token, query) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 500)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function fileFromChunk(key) {
  return key.replace(/_p\d+$/, '');
}

function maybeMarkFile(status, file) {
  const parts = [`${file}_p0`, `${file}_p1`, `${file}_p2`];
  const chunksOk = status.chunks_ok || [];
  if (parts.every((p) => chunksOk.includes(p)) && !status.ok.includes(file)) {
    status.ok.push(file);
  }
}

async function runWave(token, keys, status) {
  await Promise.all(
    keys.map(async (key) => {
      const sql = fs.readFileSync(path.join(CHUNK_DIR, `${key}.sql`), 'utf8');
      process.stdout.write(`${key} (${sql.length}b)… `);
      await postSql(token, sql);
      if (!status.chunks_ok.includes(key)) status.chunks_ok.push(key);
      maybeMarkFile(status, fileFromChunk(key));
      console.log('OK');
    })
  );
  saveStatus(status);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  const chunks = listChunks();
  const status = loadStatus();
  const pending = chunks.filter((k) => !(status.chunks_ok || []).includes(k));

  if (dryRun || !token) {
    console.log(
      JSON.stringify(
        {
          mode: token ? 'dry-run' : 'no-token',
          total_chunks: chunks.length,
          pending: pending.length,
          next: pending.slice(0, PARALLEL),
          message: token ? 'dry-run only' : 'Set SUPABASE_ACCESS_TOKEN or use MCP execute_sql',
        },
        null,
        2
      )
    );
    process.exit(token ? 0 : 1);
  }

  const before = (await postSql(token, 'SELECT count(*)::int AS n FROM public.locations;'))[0]?.n;
  status.before = before;
  console.log('Before:', before);

  for (let i = 0; i < pending.length; i += PARALLEL) {
    const wave = pending.slice(i, i + PARALLEL);
    try {
      await runWave(token, wave, status);
    } catch (err) {
      status.failed.push({ file: fileFromChunk(wave[0]), error: err.message });
      status.errors.push({ file: fileFromChunk(wave[0]), error: err.message });
      saveStatus(status);
      throw err;
    }
  }

  await postSql(token, 'ANALYZE public.locations;');
  const after = (await postSql(token, 'SELECT count(*)::int AS n FROM public.locations;'))[0]?.n;
  const caCount = (
    await postSql(
      token,
      `SELECT count(*)::int AS n FROM public.locations WHERE ST_Y(coordinates::geometry) BETWEEN 32.5 AND 42 AND ST_X(coordinates::geometry) BETWEEN -124.5 AND -114;`
    )
  )[0]?.n;
  const categories = await postSql(
    token,
    'SELECT category, count(*)::int AS n FROM public.locations GROUP BY 1 ORDER BY 1;'
  );

  status.after = after;
  status.added = after - before;
  saveStatus(status);

  console.log(
    JSON.stringify({ before, after, added: after - before, ca_count: caCount, categories, ok_files: status.ok }, null, 2)
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
