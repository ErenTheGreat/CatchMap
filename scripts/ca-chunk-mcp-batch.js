#!/usr/bin/env node
/**
 * Batch driver for CA chunk MCP import.
 * Reads chunk SQL via fs.readFileSync; emits one JSON line per chunk for agent CallMcpTool.
 * Agent loop: node scripts/ca-chunk-mcp-batch.js --emit 1 | while read; do CallMcpTool; done
 *
 * Usage:
 *   node scripts/ca-chunk-mcp-batch.js --emit 1
 *   node scripts/ca-chunk-mcp-batch.js --wave 0
 *   node scripts/ca-chunk-mcp-batch.js --pending
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const CHUNK_DIR = path.join(__dirname, '../supabase/scripts/import_batches/_ca_json_chunks');
const OUT_DIR = path.join(__dirname, '../.import/ca_chunks');
const STATUS_PATH = path.join(OUT_DIR, 'import_status.json');
const PARALLEL = 4;
const TOTAL = 42;

function loadStatus() {
  if (!fs.existsSync(STATUS_PATH)) {
    return { baseline: 2778, ok: [], failed: [], startedAt: new Date().toISOString() };
  }
  return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
}

function chunkFile(n) {
  return `chunk_${String(n).padStart(4, '0')}.sql`;
}

function readChunk(n) {
  const file = chunkFile(n);
  const sql = fs.readFileSync(path.join(CHUNK_DIR, file), 'utf8');
  return { n, file, project_id: PROJECT_ID, query: sql, bytes: sql.length };
}

function pendingChunks(status) {
  const done = new Set(status.ok || []);
  const out = [];
  for (let n = 1; n <= TOTAL; n++) {
    const file = chunkFile(n);
    if (!done.has(file)) out.push(n);
  }
  return out;
}

const args = process.argv.slice(2);
const emitIdx = args.indexOf('--emit');
if (emitIdx >= 0) {
  const n = Number(args[emitIdx + 1]);
  console.log(JSON.stringify(readChunk(n)));
  process.exit(0);
}

const waveIdx = args.indexOf('--wave');
if (waveIdx >= 0) {
  const wave = Number(args[waveIdx + 1]);
  const start = wave * PARALLEL + 1;
  const end = Math.min(start + PARALLEL - 1, TOTAL);
  const chunks = [];
  for (let n = start; n <= end; n++) chunks.push(readChunk(n));
  console.log(JSON.stringify({ wave, start, end, chunks }));
  process.exit(0);
}

if (args.includes('--pending')) {
  const status = loadStatus();
  console.log(JSON.stringify({ pending: pendingChunks(status), status }, null, 2));
  process.exit(0);
}

console.error('Usage: --emit N | --wave W | --pending');
process.exit(2);
