#!/usr/bin/env node
/**
 * List CA combined chunk keys for MCP import loop.
 * Agent calls execute_sql per chunk; this tracks progress.
 *
 * Usage:
 *   node scripts/mcp-run-all-ca-chunks.js --list
 *   node scripts/mcp-run-all-ca-chunks.js --next
 *   node scripts/mcp-run-all-ca-chunks.js --mark-chunk-ok combined_01_p0
 *   node scripts/mcp-run-all-ca-chunks.js --mark-file-ok combined_01
 *   node scripts/mcp-run-all-ca-chunks.js --status
 */
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/import-utils');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const CHUNK_DIR = path.join(
  __dirname,
  '../supabase/scripts/import_batches/_mcp_queue/ca_combined'
);
const STATUS_PATH = path.join(__dirname, '../.import/ca_chunk_status.json');

function listChunks() {
  return fs
    .readdirSync(CHUNK_DIR)
    .filter((f) => /^combined_\d+_p\d+\.sql$/.test(f))
    .map((f) => f.replace('.sql', ''))
    .sort();
}

function listFiles() {
  const seen = new Set();
  for (const key of listChunks()) {
    seen.add(key.replace(/_p\d+$/, ''));
  }
  return [...seen].sort();
}

function loadStatus() {
  if (!fs.existsSync(STATUS_PATH)) {
    return { before: 2778, chunks_ok: [], files_ok: [], failed: [], errors: [] };
  }
  return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
}

function saveStatus(status) {
  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));
}

function chunkPayload(key) {
  const sql = fs.readFileSync(path.join(CHUNK_DIR, `${key}.sql`), 'utf8');
  return { project_id: PROJECT_ID, query: sql, key, bytes: sql.length };
}

function fileChunks(file) {
  return listChunks().filter((k) => k.startsWith(`${file}_`));
}

function maybeMarkFile(status, file) {
  const chunks = fileChunks(file);
  if (chunks.every((c) => status.chunks_ok.includes(c)) && !status.files_ok.includes(file)) {
    status.files_ok.push(file);
  }
}

function main() {
  const args = parseArgs(process.argv);
  const status = loadStatus();
  const chunks = listChunks();

  if (args.flags.has('list')) {
    console.log(JSON.stringify({ chunks, files: listFiles(), total_chunks: chunks.length }, null, 2));
    return;
  }

  if (args.flags.has('status')) {
    const pending = chunks.filter((c) => !status.chunks_ok.includes(c));
    console.log(
      JSON.stringify(
        {
          ...status,
          total_chunks: chunks.length,
          pending_chunks: pending.length,
          next_chunk: pending[0] || null,
        },
        null,
        2
      )
    );
    return;
  }

  if (args.flags.has('mark-chunk-ok')) {
    const key = args.options.key || args.positional[0];
    if (!key) throw new Error('--mark-chunk-ok requires key');
    if (!status.chunks_ok.includes(key)) status.chunks_ok.push(key);
    const file = key.replace(/_p\d+$/, '');
    maybeMarkFile(status, file);
    saveStatus(status);
    console.log('chunk ok', key);
    return;
  }

  if (args.flags.has('mark-file-ok')) {
    const file = args.options.file || args.positional[0];
    if (!file) throw new Error('--mark-file-ok requires file');
    if (!status.files_ok.includes(file)) status.files_ok.push(file);
    saveStatus(status);
    console.log('file ok', file);
    return;
  }

  if (args.flags.has('mark-fail')) {
    const key = args.options.key || args.positional[0];
    const err = args.options.error || 'unknown';
    status.failed.push({ key, error: err });
    status.errors.push({ key, error: err });
    saveStatus(status);
    console.log('fail', key, err);
    return;
  }

  if (args.flags.has('next')) {
    const pending = chunks.filter((c) => !status.chunks_ok.includes(c));
    if (!pending.length) {
      console.log(JSON.stringify({ done: true, status }));
      return;
    }
    const key = pending[0];
    const payload = chunkPayload(key);
    const out = path.join(__dirname, '../.import/_next_chunk.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(payload));
    console.log(
      JSON.stringify({
        key,
        bytes: payload.bytes,
        project_id: PROJECT_ID,
        file: key.replace(/_p\d+$/, ''),
        part: key.match(/_p(\d+)$/)?.[1],
        pending: pending.length,
        out,
      })
    );
    return;
  }

  if (args.flags.has('wave')) {
    const n = Number(args.options.n || 4);
    const pending = chunks.filter((c) => !status.chunks_ok.includes(c)).slice(0, n);
    const wave = pending.map((key) => {
      const payload = chunkPayload(key);
      return { key, bytes: payload.bytes, project_id: PROJECT_ID, query: payload.query };
    });
    const out = path.join(__dirname, '../.import/_wave_chunks.json');
    fs.writeFileSync(out, JSON.stringify(wave, null, 2));
    console.log(JSON.stringify({ keys: pending, out, count: wave.length }));
    return;
  }

  console.error('Usage: --list|--status|--next|--wave [--n 4]|--mark-chunk-ok KEY|--mark-file-ok FILE|--mark-fail KEY');
  process.exit(1);
}

main();
