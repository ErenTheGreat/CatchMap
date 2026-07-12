#!/usr/bin/env node
/**
 * Read chunk SQL and print MCP execute_sql args as single-line JSON.
 * Agent: node scripts/mcp-invoke-chunk-from-file.js combined_01_p0 | ...
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const CHUNK_DIR = path.join(__dirname, '../supabase/scripts/import_batches/_mcp_queue/ca_combined');

const key = process.argv[2];
if (!key) {
  console.error('Usage: node scripts/mcp-invoke-chunk-from-file.js combined_01_p0');
  process.exit(1);
}

const sql = fs.readFileSync(path.join(CHUNK_DIR, `${key}.sql`), 'utf8');
process.stdout.write(JSON.stringify({ project_id: PROJECT_ID, query: sql, key }));
