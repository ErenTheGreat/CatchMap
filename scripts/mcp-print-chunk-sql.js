#!/usr/bin/env node
/** Print SQL from chunk key for MCP execute_sql (stdout = raw SQL). */
const fs = require('fs');
const path = require('path');
const key = process.argv[2];
if (!key) {
  console.error('Usage: node scripts/mcp-print-chunk-sql.js combined_01_p0');
  process.exit(1);
}
const p = path.join(__dirname, '../supabase/scripts/import_batches/_mcp_queue/ca_combined', `${key}.sql`);
process.stdout.write(fs.readFileSync(p, 'utf8'));
