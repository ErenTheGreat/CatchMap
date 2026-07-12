#!/usr/bin/env node
/**
 * Loop through combined_01..14 invoke JSON files and emit SQL paths for MCP import.
 * Parent agent calls execute_sql per file using emit-sql-for-mcp.js output.
 *
 * Usage:
 *   node scripts/mcp-import-loop-ca.js --emit combined_01
 *   node scripts/mcp-import-loop-ca.js --list
 *   node scripts/mcp-import-loop-ca.js --status
 */
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/import-utils');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const RUN_ARGS = path.join(__dirname, '../supabase/scripts/import_batches/_mcp_queue/run_args');
const STATUS = path.join(__dirname, '../.import/ca_import_status.json');

function listFiles() {
  return fs
    .readdirSync(RUN_ARGS)
    .filter((f) => /^_invoke_combined_\d+\.json$/.test(f))
    .sort()
    .map((f) => f.replace('_invoke_', '').replace('.json', ''));
}

function loadStatus() {
  if (!fs.existsSync(STATUS)) {
    return { before: null, ok: [], failed: [], errors: [] };
  }
  return JSON.parse(fs.readFileSync(STATUS, 'utf8'));
}

function saveStatus(status) {
  fs.mkdirSync(path.dirname(STATUS), { recursive: true });
  fs.writeFileSync(STATUS, JSON.stringify(status, null, 2));
}

function main() {
  const args = parseArgs(process.argv);
  const files = listFiles();

  if (args.flags.has('list')) {
    console.log(JSON.stringify(files, null, 2));
    return;
  }

  if (args.flags.has('status')) {
    console.log(JSON.stringify(loadStatus(), null, 2));
    return;
  }

  const key = args.options.emit;
  if (!key) {
    console.error('Usage: --list | --status | --emit combined_01');
    process.exit(1);
  }

  const invokePath = path.join(RUN_ARGS, `_invoke_${key}.json`);
  if (!fs.existsSync(invokePath)) {
    console.error(`Missing invoke payload: ${invokePath}`);
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(invokePath, 'utf8'));
  const outSql = path.join(__dirname, '../.import/mcp_query.sql');
  fs.mkdirSync(path.dirname(outSql), { recursive: true });
  fs.writeFileSync(outSql, payload.query);
  console.log(
    JSON.stringify({
      project_id: PROJECT_ID,
      file: payload._file || `${key}.sql`,
      key,
      sql_path: outSql,
      bytes: payload.query.length,
    })
  );
}

main();
