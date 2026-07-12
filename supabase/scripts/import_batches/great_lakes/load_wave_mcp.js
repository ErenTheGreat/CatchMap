#!/usr/bin/env node
/**
 * Load one wave of chunk SQL for MCP execute_sql (CallMcpTool).
 * Node reads _chunks/*.sql via fs.readFileSync.
 *
 * Usage: node load_wave_mcp.js <waveIndex>
 * Output: JSON array of { project_id, name, query }
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const CHUNK_DIR = path.join(__dirname, '_chunks');
const wave = parseInt(process.argv[2] ?? '0', 10);

const files = fs
  .readdirSync(CHUNK_DIR)
  .filter((f) => /^batch_\d+_chunk_\d+\.sql$/.test(f))
  .sort((a, b) => {
    const pa = a.match(/batch_(\d+)_chunk_(\d+)/);
    const pb = b.match(/batch_(\d+)_chunk_(\d+)/);
    return +pa[1] - +pb[1] || +pa[2] - +pb[2];
  });

const batch = files.slice(wave * 4, wave * 4 + 4).map((name) => ({
  project_id: PROJECT_ID,
  name,
  query: fs.readFileSync(path.join(CHUNK_DIR, name), 'utf8'),
}));

if (!batch.length) process.exit(2);
process.stdout.write(JSON.stringify(batch));
