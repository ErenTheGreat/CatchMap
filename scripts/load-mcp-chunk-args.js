#!/usr/bin/env node
/** Output {project_id, query} JSON for MCP execute_sql from chunk number (1-42). */
const fs = require('fs');
const path = require('path');

const n = Number(process.argv[2]);
if (!n || n < 1 || n > 42) {
  console.error('Usage: node scripts/load-mcp-chunk-args.js <1-42>');
  process.exit(2);
}

const pad = String(n).padStart(4, '0');
const mcpPath = path.join(__dirname, `../.import/ca_chunks/mcp_${pad}.json`);
const chunkPath = path.join(
  __dirname,
  '../supabase/scripts/import_batches/_ca_json_chunks',
  `chunk_${pad}.sql`
);

let payload;
if (fs.existsSync(mcpPath)) {
  payload = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
} else {
  payload = {
    project_id: 'cpzwvlpqdzjjsdlnmfgg',
    file: `chunk_${pad}.sql`,
    query: fs.readFileSync(chunkPath, 'utf8'),
  };
}

process.stdout.write(
  JSON.stringify({ project_id: payload.project_id, query: payload.query })
);
