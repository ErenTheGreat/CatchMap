#!/usr/bin/env node
/**
 * Import one SQL file via Supabase MCP execute_sql pattern.
 * Prints instructions; for automated runs use Supabase MCP plugin directly.
 *
 * Usage: node scripts/mcp-import-file.js path/to.sql
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/mcp-import-file.js <sql-file>');
  process.exit(1);
}
const query = fs.readFileSync(path.resolve(file), 'utf8');
console.log(JSON.stringify({ project_id: PROJECT_ID, query, _bytes: query.length }));
