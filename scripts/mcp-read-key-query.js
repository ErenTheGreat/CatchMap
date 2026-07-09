#!/usr/bin/env node
/** Print SQL query for mini-chunk key. Usage: node scripts/mcp-read-key-query.js KEY */
const fs = require('fs');
const path = require('path');
const key = process.argv[2];
if (!key) {
  console.error('Usage: node scripts/mcp-read-key-query.js KEY');
  process.exit(1);
}
const sqlPath = path.join(__dirname, '../.import/mini_chunks', `${key}.sql`);
process.stdout.write(fs.readFileSync(sqlPath, 'utf8'));
