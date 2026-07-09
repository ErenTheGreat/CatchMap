#!/usr/bin/env node
/**
 * Print next pending mini-chunk SQL for MCP execute_sql.
 * Usage: node scripts/mcp-get-query.js combined_01_p1__m00
 *        node scripts/mcp-get-query.js --next
 */
const fs = require('fs');
const path = require('path');

const MINI_DIR = path.join(__dirname, '../.import/mini_chunks');
const MANIFEST = path.join(MINI_DIR, 'manifest.json');
const STATUS = path.join(__dirname, '../.import/ca_mini_status.json');
const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';

function pendingKeys() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const status = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
  const ok = new Set(status.ok);
  return manifest.mini.map((m) => m.key).sort().filter((k) => !ok.has(k));
}

const arg = process.argv[2];
let key = arg;
if (arg === '--next') {
  const pending = pendingKeys();
  if (!pending.length) {
    console.error('No pending mini-chunks');
    process.exit(0);
  }
  key = pending[0];
}

if (!key) {
  console.error('Usage: node scripts/mcp-get-query.js KEY | --next');
  process.exit(1);
}

const sqlPath = path.join(MINI_DIR, `${key}.sql`);
if (!fs.existsSync(sqlPath)) {
  console.error(`Missing: ${sqlPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');
process.stdout.write(JSON.stringify({ project_id: PROJECT_ID, key, query: sql, bytes: sql.length }));
