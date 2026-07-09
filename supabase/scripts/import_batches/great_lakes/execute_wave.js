#!/usr/bin/env node
/**
 * Execute one wave of Great Lakes chunk imports via MCP execute_sql payloads.
 * Reads chunk SQL with Node from _mcp_exec/payloads/*.json and prints wave summary.
 * Pair with plugin-supabase-supabase execute_sql for each payload in the wave.
 *
 * Usage: node execute_wave.js <waveIndex>
 */
const fs = require('fs');
const path = require('path');

const PAYLOAD_DIR = path.join(__dirname, '_mcp_exec/payloads');
const wave = parseInt(process.argv[2] || '0', 10);

const files = fs
  .readdirSync(PAYLOAD_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort((a, b) => {
    const pa = a.match(/batch_(\d+)_chunk_(\d+)/);
    const pb = b.match(/batch_(\d+)_chunk_(\d+)/);
    return +pa[1] - +pb[1] || +pa[2] - +pb[2];
  });

const batch = files.slice(wave * 4, wave * 4 + 4).map((f) => {
  const payload = JSON.parse(fs.readFileSync(path.join(PAYLOAD_DIR, f), 'utf8'));
  return payload;
});

if (!batch.length) {
  process.exit(2);
}

process.stdout.write(JSON.stringify({ wave, items: batch.map((p) => ({ name: p.name, bytes: p.query.length })) }));
