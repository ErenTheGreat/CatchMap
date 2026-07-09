#!/usr/bin/env node
/**
 * Track Great Lakes MCP import progress.
 * Usage:
 *   node _gl_status.js next          # write _cursor_mcp_next.json for next chunk
 *   node _gl_status.js mark-ok NAME  # mark chunk ok
 *   node _gl_status.js wave W        # write _cursor_mcp_wave.json (4 chunks)
 *   node _gl_status.js summary
 */
const fs = require('fs');
const path = require('path');

const BASE = __dirname;
const CHUNK_DIR = path.join(BASE, '_chunks');
const STATUS_FILE = path.join(BASE, '_gl_import_status.json');
const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';

function listChunks() {
  return fs
    .readdirSync(CHUNK_DIR)
    .filter((f) => /^batch_\d+_chunk_\d+\.sql$/.test(f))
    .sort((a, b) => {
      const pa = a.match(/batch_(\d+)_chunk_(\d+)/);
      const pb = b.match(/batch_(\d+)_chunk_(\d+)/);
      return +pa[1] - +pb[1] || +pa[2] - +pb[2];
    });
}

function loadStatus() {
  if (!fs.existsSync(STATUS_FILE)) {
    return { ok: [], failed: [], pending: listChunks() };
  }
  return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
}

function saveStatus(s) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(s, null, 2));
}

const cmd = process.argv[2];

if (cmd === 'init') {
  const s = { ok: [], failed: [], pending: listChunks(), baseline: null, after: null };
  saveStatus(s);
  console.log(JSON.stringify({ total: s.pending.length }));
  process.exit(0);
}

if (cmd === 'mark-ok') {
  const name = process.argv[3];
  const s = loadStatus();
  s.pending = s.pending.filter((f) => f !== name);
  if (!s.ok.includes(name)) s.ok.push(name);
  saveStatus(s);
  console.log(JSON.stringify({ ok: s.ok.length, pending: s.pending.length }));
  process.exit(0);
}

if (cmd === 'mark-fail') {
  const name = process.argv[3];
  const err = process.argv[4] || 'unknown';
  const s = loadStatus();
  s.pending = s.pending.filter((f) => f !== name);
  s.failed.push({ name, error: err });
  saveStatus(s);
  console.log(JSON.stringify({ failed: s.failed.length, pending: s.pending.length }));
  process.exit(0);
}

if (cmd === 'next') {
  const s = loadStatus();
  const name = s.pending[0];
  if (!name) {
    console.log(JSON.stringify({ done: true }));
    process.exit(0);
  }
  const query = fs.readFileSync(path.join(CHUNK_DIR, name), 'utf8');
  const out = { project_id: PROJECT_ID, name, query };
  fs.writeFileSync(path.join(BASE, '_cursor_mcp_next.json'), JSON.stringify(out));
  console.log(JSON.stringify({ name, bytes: query.length }));
  process.exit(0);
}

if (cmd === 'wave') {
  const w = +process.argv[3] || 0;
  const all = listChunks();
  const batch = all.slice(w * 4, w * 4 + 4);
  const items = batch.map((name) => ({
    project_id: PROJECT_ID,
    name,
    query: fs.readFileSync(path.join(CHUNK_DIR, name), 'utf8'),
  }));
  fs.writeFileSync(path.join(BASE, '_cursor_mcp_wave.json'), JSON.stringify(items));
  console.log(JSON.stringify({ wave: w, chunks: batch }));
  process.exit(0);
}

if (cmd === 'summary') {
  const s = loadStatus();
  console.log(JSON.stringify(s, null, 2));
  process.exit(0);
}

console.error('Usage: init | next | mark-ok NAME | mark-fail NAME ERR | wave N | summary');
process.exit(1);
