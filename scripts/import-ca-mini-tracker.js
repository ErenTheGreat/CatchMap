#!/usr/bin/env node
/**
 * Import all 42 CA chunks via mini-batch SQL (~15KB) using MCP-sized payloads.
 * Agent calls execute_sql per mini file; this script tracks progress.
 *
 * Usage:
 *   node scripts/import-ca-mini-tracker.js --list-pending
 *   node scripts/import-ca-mini-tracker.js --mark-ok chunk_0001__m00
 *   node scripts/import-ca-mini-tracker.js --wave 0
 */
const fs = require('fs');
const path = require('path');

const MINI_DIR = path.join(__dirname, '../.import/ca_mini_chunks');
const MANIFEST = path.join(MINI_DIR, 'manifest.json');
const STATUS = path.join(MINI_DIR, 'import_status.json');
const PARALLEL = 4;

function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
}

function loadStatus() {
  if (!fs.existsSync(STATUS)) {
    return { baseline: 2778, ok: [], failed: [] };
  }
  return JSON.parse(fs.readFileSync(STATUS, 'utf8'));
}

function saveStatus(s) {
  fs.writeFileSync(STATUS, JSON.stringify(s, null, 2));
}

function pending() {
  const m = loadManifest();
  const s = loadStatus();
  const done = new Set(s.ok || []);
  return m.mini.filter((x) => !done.has(x.key));
}

const arg = process.argv[2];
const val = process.argv[3];

if (arg === '--list-pending') {
  const p = pending();
  console.log(JSON.stringify({ pending: p.length, keys: p.map((x) => x.key) }, null, 2));
} else if (arg === '--mark-ok' && val) {
  const s = loadStatus();
  if (!s.ok.includes(val)) s.ok.push(val);
  s.failed = (s.failed || []).filter((x) => x.key !== val);
  saveStatus(s);
  console.log('ok', val);
} else if (arg === '--mark-fail' && val) {
  const err = process.argv[4] || 'unknown';
  const s = loadStatus();
  s.failed = s.failed || [];
  s.failed.push({ key: val, error: err });
  saveStatus(s);
  console.log('fail', val);
} else if (arg === '--wave') {
  const wave = Number(val || 0);
  const p = pending();
  const slice = p.slice(wave * PARALLEL, wave * PARALLEL + PARALLEL);
  const out = slice.map((x) => ({
    key: x.key,
    parent: x.parent,
    bytes: x.bytes,
    project_id: 'cpzwvlpqdzjjsdlnmfgg',
    query: fs.readFileSync(path.join(MINI_DIR, `${x.key}.sql`), 'utf8'),
  }));
  console.log(JSON.stringify({ wave, count: out.length, items: out.map((o) => ({ key: o.key, bytes: o.bytes })) }, null, 2));
  const outPath = path.join(MINI_DIR, `wave_${String(wave).padStart(3, '0')}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.error('wrote', outPath);
} else if (arg === '--emit') {
  const key = val;
  const query = fs.readFileSync(path.join(MINI_DIR, `${key}.sql`), 'utf8');
  process.stdout.write(JSON.stringify({ project_id: 'cpzwvlpqdzjjsdlnmfgg', query, key }));
} else {
  console.error('Usage: --list-pending | --wave N | --emit KEY | --mark-ok KEY | --mark-fail KEY [err]');
  process.exit(2);
}
