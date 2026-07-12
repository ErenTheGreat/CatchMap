#!/usr/bin/env node
/**
 * Read SQL from _ca_combined or invoke key and print JSON args for MCP execute_sql.
 * Usage: node scripts/mcp-exec-from-file.js combined_01
 *        node scripts/mcp-exec-from-file.js --path supabase/scripts/import_batches/_ca_combined/combined_01.sql
 */
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/import-utils');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const FULL_DIR = path.join(__dirname, '../supabase/scripts/import_batches/_ca_combined');
const RUN_ARGS = path.join(__dirname, '../supabase/scripts/import_batches/_mcp_queue/run_args');

function resolveSql(args) {
  if (args.options.path) {
    return { file: path.basename(args.options.path), sql: fs.readFileSync(path.resolve(args.options.path), 'utf8') };
  }
  const key = args.positional[0];
  if (!key) throw new Error('Provide combined_XX or --path');
  const fullPath = path.join(FULL_DIR, `${key}.sql`);
  if (fs.existsSync(fullPath)) {
    return { file: `${key}.sql`, sql: fs.readFileSync(fullPath, 'utf8') };
  }
  const invokePath = path.join(RUN_ARGS, `_invoke_${key}.json`);
  const payload = JSON.parse(fs.readFileSync(invokePath, 'utf8'));
  return { file: payload._file || `${key}.sql`, sql: payload.query };
}

const args = parseArgs(process.argv);
const { file, sql } = resolveSql(args);
const out = { project_id: PROJECT_ID, query: sql, _file: file };
process.stdout.write(JSON.stringify(out));
