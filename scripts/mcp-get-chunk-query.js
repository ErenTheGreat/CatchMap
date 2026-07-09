#!/usr/bin/env node
/** Output {project_id, query} JSON for MCP execute_sql from chunk key. */
const fs = require('fs');
const path = require('path');
const key = process.argv[2];
if (!key) {
  console.error('Usage: node scripts/mcp-get-chunk-query.js combined_01_p0');
  process.exit(1);
}
const p = path.join(
  __dirname,
  '../supabase/scripts/import_batches/_mcp_queue/ca_combined',
  `${key}.sql`
);
const query = fs.readFileSync(p, 'utf8');
process.stdout.write(JSON.stringify({ project_id: 'cpzwvlpqdzjjsdlnmfgg', query, key }));
