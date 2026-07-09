#!/usr/bin/env node
/**
 * Read CA JSON chunk SQL via fs.readFileSync and emit wave payloads for MCP execute_sql.
 * Usage: node scripts/import-ca-json-chunks-wave.js --wave 0
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
const PARALLEL = 4;
const TOTAL = 42;

function chunkFile(n) {
  return `chunk_${String(n).padStart(4, '0')}.sql`;
}

function main() {
  const args = parseArgs(process.argv);
  const wave = Number(args.options.wave ?? 0);
  const start = wave * PARALLEL + 1;
  const end = Math.min(start + PARALLEL - 1, TOTAL);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const payloads = [];
  for (let i = start; i <= end; i++) {
    const file = chunkFile(i);
    const sql = fs.readFileSync(path.join(CHUNK_DIR, file), 'utf8');
    payloads.push({ project_id: PROJECT_ID, file, bytes: sql.length, query: sql });
  }

  const outPath = path.join(OUT_DIR, `wave_${String(wave).padStart(2, '0')}.json`);
  fs.writeFileSync(outPath, JSON.stringify(payloads));
  console.log(JSON.stringify({ wave, start, end, outPath, files: payloads.map((p) => p.file) }));
}

main();
