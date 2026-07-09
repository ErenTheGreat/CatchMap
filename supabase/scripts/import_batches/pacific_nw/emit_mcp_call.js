#!/usr/bin/env node
/** Emit MCP execute_sql args for one chunk: node emit_mcp_call.js <wave> <chunkIndex> */
const fs = require('fs');
const path = require('path');
const wave = parseInt(process.argv[2] ?? '0', 10);
const idx = parseInt(process.argv[3] ?? '0', 10);
const file = path.join(__dirname, '../../../../.import/pacific_nw_exec', `load_wave_${wave}.json`);
const batch = JSON.parse(fs.readFileSync(file, 'utf8'));
const item = batch[idx];
if (!item) {
  console.error('No chunk at wave', wave, 'idx', idx);
  process.exit(1);
}
process.stdout.write(JSON.stringify({ project_id: item.project_id, query: item.query, name: item.name }));
