#!/usr/bin/env node
/**
 * Emit MCP execute_sql args for one mini-chunk key (reads .import/mini_chunks/{key}.sql).
 * Usage: node scripts/mcp-emit-key.js combined_01_p2__m02
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const MINI_DIR = path.join(__dirname, '../.import/mini_chunks');

const key = process.argv[2];
if (!key) {
  console.error('Usage: node scripts/mcp-emit-key.js KEY');
  process.exit(1);
}

const sqlPath = path.join(MINI_DIR, `${key}.sql`);
if (!fs.existsSync(sqlPath)) {
  console.error(`Missing ${sqlPath}`);
  process.exit(1);
}

process.stdout.write(
  JSON.stringify({
    project_id: PROJECT_ID,
    query: fs.readFileSync(sqlPath, 'utf8'),
    key,
  })
);
