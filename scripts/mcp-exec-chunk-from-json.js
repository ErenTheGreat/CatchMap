#!/usr/bin/env node
/**
 * Print MCP execute_sql arguments for a chunk invoke JSON file.
 * Usage: node scripts/mcp-exec-chunk-from-json.js .import/_exec_combined_01_p0.json
 */
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/mcp-exec-chunk-from-json.js <invoke.json>');
  process.exit(2);
}

const payload = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
process.stdout.write(JSON.stringify({ project_id: payload.project_id, query: payload.query }));
