#!/usr/bin/env node
/** Print SQL query for a key from mcp_exec cache. Usage: node scripts/mcp-read-wave-query.js KEY */
const fs = require('fs');
const path = require('path');
const key = process.argv[2];
if (!key) {
  console.error('Usage: node scripts/mcp-read-wave-query.js KEY');
  process.exit(1);
}
const p = path.join(__dirname, '../.import/mcp_exec', `${key}.q.sql`);
if (!fs.existsSync(p)) {
  const alt = path.join(__dirname, '../.import/mini_chunks', `${key}.sql`);
  if (!fs.existsSync(alt)) {
    console.error(`Missing: ${p}`);
    process.exit(1);
  }
  process.stdout.write(fs.readFileSync(alt, 'utf8'));
} else {
  process.stdout.write(fs.readFileSync(p, 'utf8'));
}
