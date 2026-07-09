#!/usr/bin/env node
/**
 * Run one mini-chunk import wave via MCP HTTP using Cursor plugin auth is unavailable;
 * this script reads SQL from mini_chunks and prints MCP args for agent CallMcpTool.
 *
 * For automated run with token:
 *   SUPABASE_ACCESS_TOKEN=... node scripts/mcp-run-mini-wave-auto.js [waveSize]
 *
 * For agent loop (default):
 *   node scripts/mcp-run-mini-wave-auto.js 8 --emit-only
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const MINI_DIR = path.join(__dirname, '../.import/mini_chunks');
const MANIFEST = path.join(MINI_DIR, 'manifest.json');
const STATUS = path.join(__dirname, '../.import/ca_mini_status.json');
const RUNNER = path.join(__dirname, 'mcp-mini-chunk-runner.js');
const EXEC_DIR = path.join(__dirname, '../.import/mcp_exec');

function pendingKeys() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const status = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
  const ok = new Set(status.ok || []);
  return manifest.mini.map((m) => m.key).sort().filter((k) => !ok.has(k));
}

async function postSql(token, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 400)}`);
  return text;
}

function markOk(key) {
  spawnSync(process.execPath, [RUNNER, '--mark-ok', '--key', key], { stdio: 'pipe' });
}

async function main() {
  const waveSize = Number(process.argv[2] || 8);
  const emitOnly = process.argv.includes('--emit-only');
  const pending = pendingKeys();
  const wave = pending.slice(0, waveSize);

  fs.mkdirSync(EXEC_DIR, { recursive: true });
  for (const key of wave) {
    const sql = fs.readFileSync(path.join(MINI_DIR, `${key}.sql`), 'utf8');
    fs.writeFileSync(
      path.join(EXEC_DIR, `${key}.mcp.json`),
      JSON.stringify({ project_id: PROJECT_ID, query: sql, key })
    );
  }

  if (emitOnly) {
    console.log(JSON.stringify({ wave, pending_remaining: pending.length - wave.length, exec_dir: EXEC_DIR }));
    return;
  }

  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  if (!token) {
    console.error('No token. Use --emit-only and CallMcpTool execute_sql per key in wave.');
    process.exit(1);
  }

  const failed = [];
  await Promise.all(
    wave.map(async (key) => {
      const sql = fs.readFileSync(path.join(MINI_DIR, `${key}.sql`), 'utf8');
      try {
        await postSql(token, sql);
        markOk(key);
        console.log(`${key}:ok`);
      } catch (e) {
        failed.push({ key, error: String(e.message).slice(0, 300) });
        console.log(`${key}:fail`);
      }
    })
  );

  if (failed.length) {
    console.log(JSON.stringify({ failed }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: wave.length, keys: wave }));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
