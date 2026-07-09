#!/usr/bin/env node
/**
 * Emit MCP execute_sql payloads for one mini-chunk wave (4 parallel).
 * Agent reads wave JSON and calls CallMcpTool per item.
 *
 * Usage: node scripts/mcp-exec-mini-wave.js 0
 */
const fs = require('fs');
const path = require('path');

const MINI_DIR = path.join(__dirname, '../.import/ca_mini_chunks');
const MANIFEST = path.join(MINI_DIR, 'manifest.json');
const STATUS = path.join(MINI_DIR, 'import_status.json');
const PARALLEL = 4;
const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';

function loadStatus() {
  if (!fs.existsSync(STATUS)) return { ok: [], failed: [] };
  return JSON.parse(fs.readFileSync(STATUS, 'utf8'));
}

const wave = Number(process.argv[2] || 0);
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const status = loadStatus();
const done = new Set(status.ok || []);
const pending = manifest.mini.filter((x) => !done.has(x.key));
const slice = pending.slice(wave * PARALLEL, wave * PARALLEL + PARALLEL);

const payloads = slice.map((x) => ({
  key: x.key,
  parent: x.parent,
  project_id: PROJECT_ID,
  query: fs.readFileSync(path.join(MINI_DIR, `${x.key}.sql`), 'utf8'),
}));

const out = path.join(MINI_DIR, `_mcp_wave_${String(wave).padStart(3, '0')}.json`);
fs.writeFileSync(out, JSON.stringify(payloads, null, 2));
console.log(JSON.stringify({ wave, count: payloads.length, keys: payloads.map((p) => p.key), out }));
