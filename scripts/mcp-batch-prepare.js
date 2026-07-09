#!/usr/bin/env node
/**
 * Batch-import CA combined chunks by writing MCP payloads for agent execution.
 * Outputs one line per chunk: CHUNK_KEY|ARGS_FILE
 * Agent reads ARGS_FILE and calls execute_sql with JSON contents.
 *
 * Usage:
 *   node scripts/mcp-batch-prepare.js --all
 *   node scripts/mcp-batch-prepare.js --pending
 *   node scripts/mcp-batch-prepare.js --key combined_01_p0
 */
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/import-utils');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const CHUNK_DIR = path.join(__dirname, '../supabase/scripts/import_batches/_mcp_queue/ca_combined');
const OUT_DIR = path.join(__dirname, '../.import/mcp_args');
const STATUS_PATH = path.join(__dirname, '../.import/ca_chunk_status.json');

function listChunks() {
  return fs
    .readdirSync(CHUNK_DIR)
    .filter((f) => /^combined_\d+_p\d+\.sql$/.test(f))
    .map((f) => f.replace('.sql', ''))
    .sort();
}

function loadStatus() {
  if (!fs.existsSync(STATUS_PATH)) {
    return { before: 2778, chunks_ok: [], files_ok: [], failed: [], errors: [] };
  }
  return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
}

function writeArgs(key) {
  const sql = fs.readFileSync(path.join(CHUNK_DIR, `${key}.sql`), 'utf8');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `${key}.json`);
  fs.writeFileSync(out, JSON.stringify({ project_id: PROJECT_ID, query: sql, key }));
  return { key, out, bytes: sql.length };
}

function main() {
  const args = parseArgs(process.argv);
  const status = loadStatus();
  const all = listChunks();

  let keys = all;
  if (args.flags.has('pending')) {
    keys = all.filter((k) => !status.chunks_ok.includes(k));
  }
  if (args.options.key || args.positional[0]) {
    keys = [args.options.key || args.positional[0]];
  }

  const written = keys.map(writeArgs);
  if (args.flags.has('list')) {
    console.log(JSON.stringify({ keys: written.map((w) => w.key), count: written.length }, null, 2));
    return;
  }

  for (const w of written) {
    console.log(`${w.key}|${w.out}|${w.bytes}`);
  }
}

main();
