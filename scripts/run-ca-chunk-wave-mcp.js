#!/usr/bin/env node
/**
 * Read CA JSON chunk SQL via fs.readFileSync and emit MCP execute_sql payloads per wave.
 * Parent agent calls CallMcpTool with each payload query.
 *
 * Usage:
 *   node scripts/run-ca-chunk-wave-mcp.js --wave 0
 *   node scripts/run-ca-chunk-wave-mcp.js --chunk 1
 *   node scripts/run-ca-chunk-wave-mcp.js --mark-ok chunk_0001.sql
 */
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/import-utils');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const CHUNK_DIR = path.join(
  __dirname,
  '../supabase/scripts/import_batches/_ca_json_chunks'
);
const OUT_DIR = path.join(__dirname, '../.import/ca_chunks');
const STATUS_PATH = path.join(OUT_DIR, 'import_status.json');
const PARALLEL = 4;
const TOTAL = 42;

function chunkFile(n) {
  return `chunk_${String(n).padStart(4, '0')}.sql`;
}

function loadStatus() {
  if (!fs.existsSync(STATUS_PATH)) {
    return { baseline: 2778, ok: [], failed: [], startedAt: new Date().toISOString() };
  }
  return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
}

function saveStatus(status) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));
}

function readChunkSql(n) {
  const file = chunkFile(n);
  const sql = fs.readFileSync(path.join(CHUNK_DIR, file), 'utf8');
  return { file, sql, bytes: sql.length };
}

function main() {
  const args = parseArgs(process.argv);
  const status = loadStatus();

  if (args.flags.has('status')) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  if (args.flags.has('mark-ok')) {
    const file = args.options.file;
    if (!file) throw new Error('--mark-ok requires --file chunk_XXXX.sql');
    if (!status.ok.includes(file)) status.ok.push(file);
    status.failed = status.failed.filter((f) => f.file !== file);
    saveStatus(status);
    console.log('OK', file);
    return;
  }

  if (args.flags.has('mark-fail')) {
    const file = args.options.file;
    const error = args.options.error || 'unknown';
    if (!status.failed.some((f) => f.file === file)) {
      status.failed.push({ file, error });
    }
    saveStatus(status);
    console.log('FAIL', file, error);
    return;
  }

  if (args.options.chunk) {
    const n = Number(args.options.chunk);
    const { file, sql, bytes } = readChunkSql(n);
    const payload = { project_id: PROJECT_ID, file, bytes, query: sql };
    const out = path.join(OUT_DIR, `invoke_${String(n).padStart(4, '0')}.json`);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(out, JSON.stringify(payload));
    console.log(JSON.stringify({ out, file, bytes, project_id: PROJECT_ID }));
    return;
  }

  const wave = Number(args.options.wave ?? 0);
  const start = wave * PARALLEL + 1;
  const end = Math.min(start + PARALLEL - 1, TOTAL);
  const payloads = [];
  for (let i = start; i <= end; i++) {
    const { file, sql, bytes } = readChunkSql(i);
    payloads.push({ project_id: PROJECT_ID, file, bytes, query: sql });
  }
  const outPath = path.join(OUT_DIR, `wave_${String(wave).padStart(2, '0')}_invoke.json`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payloads, null, 2));
  console.log(
    JSON.stringify({
      wave,
      start,
      end,
      outPath,
      files: payloads.map((p) => p.file),
      pending: TOTAL - status.ok.length,
      ok: status.ok.length,
      failed: status.failed.length,
    })
  );
}

main();
