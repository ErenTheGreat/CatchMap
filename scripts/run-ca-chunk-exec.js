#!/usr/bin/env node
/**
 * Execute CA chunk SQL via Supabase Management API (same backend as MCP execute_sql).
 * Requires SUPABASE_ACCESS_TOKEN in env (Cursor MCP plugin auth).
 *
 * Usage: node scripts/run-ca-chunk-exec.js 1 2 3 4
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const CHUNK_DIR = path.join(__dirname, '../supabase/scripts/import_batches/_ca_json_chunks');
const STATUS_SCRIPT = path.join(__dirname, 'run-ca-chunk-wave-mcp.js');

function readChunkSql(n) {
  const file = `chunk_${String(n).padStart(4, '0')}.sql`;
  return { file, sql: fs.readFileSync(path.join(CHUNK_DIR, file), 'utf8') };
}

function mark(file, ok, error) {
  const args = ok
    ? ['--mark-ok', '--file', file]
    : ['--mark-fail', '--file', file, '--error', error || 'unknown'];
  spawnSync('node', [STATUS_SCRIPT, ...args], { stdio: 'inherit' });
}

async function execSql(query) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN not set');
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 500)}`);
  return text;
}

async function main() {
  const nums = process.argv.slice(2).map(Number).filter(Boolean);
  if (!nums.length) {
    console.error('Usage: node scripts/run-ca-chunk-exec.js 1 2 3 4');
    process.exit(1);
  }
  const results = await Promise.all(
    nums.map(async (n) => {
      const { file, sql } = readChunkSql(n);
      try {
        await execSql(sql);
        mark(file, true);
        return { n, file, ok: true };
      } catch (e) {
        mark(file, false, String(e.message || e));
        return { n, file, ok: false, error: String(e.message || e) };
      }
    })
  );
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
