#!/usr/bin/env node
/**
 * Print SQL batch files for agent/MCP import (one file path per line).
 * Usage: node scripts/import-region-batches-stdin.js gulf_coast
 */
const fs = require('fs');
const path = require('path');

const region = process.argv[2];
if (!region) {
  console.error('Usage: node scripts/import-region-batches-stdin.js <region>');
  process.exit(1);
}

const dir = path.join(__dirname, '..', 'supabase/scripts/import_batches', region);
const files = fs
  .readdirSync(dir)
  .filter((f) => /^batch_\d+\.sql$/.test(f))
  .sort();

for (const file of files) {
  const sql = fs.readFileSync(path.join(dir, file), 'utf8');
  console.log(JSON.stringify({ file, region, bytes: sql.length, sql }));
}
