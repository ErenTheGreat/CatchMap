#!/usr/bin/env node
/**
 * Load chunk SQL and output MCP execute_sql args as JSON to stdout.
 * Usage: node scripts/mcp-load-chunk.js 2
 */
const fs = require('fs');
const path = require('path');

const n = Number(process.argv[2]);
if (!n) {
  console.error('Usage: node scripts/mcp-load-chunk.js <chunk 1-42>');
  process.exit(2);
}

const qPath = path.join(__dirname, `../.import/ca_chunks/_q_${n}.sql`);
const query = fs.readFileSync(qPath, 'utf8');
process.stdout.write(JSON.stringify({ project_id: 'cpzwvlpqdzjjsdlnmfgg', query, chunk: n }));
