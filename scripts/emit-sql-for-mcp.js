#!/usr/bin/env node
/** Emit raw SQL from invoke JSON or .sql path for MCP execute_sql. */
const fs = require('fs');
const path = require('path');

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node scripts/emit-sql-for-mcp.js <invoke_key|path/to.sql>');
  process.exit(1);
}

let sql;
if (arg.endsWith('.sql')) {
  sql = fs.readFileSync(path.resolve(arg), 'utf8');
} else {
  const invokePath = path.join(
    __dirname,
    '../supabase/scripts/import_batches/_mcp_queue/run_args',
    `_invoke_${arg}.json`
  );
  const payload = JSON.parse(fs.readFileSync(invokePath, 'utf8'));
  sql = payload.query;
}
process.stdout.write(sql);
