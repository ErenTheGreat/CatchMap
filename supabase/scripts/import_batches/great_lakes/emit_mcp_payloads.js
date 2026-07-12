#!/usr/bin/env node
/**
 * Read Great Lakes chunk SQL files and emit MCP execute_sql payloads as JSON lines.
 * Parent agent reads stdout and calls plugin-supabase-supabase execute_sql.
 *
 * Usage:
 *   node emit_mcp_payloads.js              # all chunks
 *   node emit_mcp_payloads.js --wave 0     # single wave (4 chunks)
 *   node emit_mcp_payloads.js --from 0 --to 23
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const CHUNK_DIR = path.join(__dirname, '_chunks');

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

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { wave: null, from: 0, to: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--wave') out.wave = +args[++i];
    else if (args[i] === '--from') out.from = +args[++i];
    else if (args[i] === '--to') out.to = +args[++i];
  }
  return out;
}

const { wave, from, to } = parseArgs();
const all = listChunks();
let chunks = all;

if (wave != null) {
  chunks = all.slice(wave * 4, wave * 4 + 4);
} else {
  const end = to == null ? Math.ceil(all.length / 4) - 1 : to;
  chunks = all.slice(from * 4, (end + 1) * 4);
}

for (const name of chunks) {
  const sql = fs.readFileSync(path.join(CHUNK_DIR, name), 'utf8');
  process.stdout.write(
    JSON.stringify({
      project_id: PROJECT_ID,
      name,
      query: sql,
    }) + '\n'
  );
}
