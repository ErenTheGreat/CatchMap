#!/usr/bin/env node
/**
 * Run all combined_01..14 imports via Supabase MCP execute_sql.
 * Reads full SQL from _ca_combined with fs; tracks progress in .import/ca_import_status.json.
 *
 * This script prepares payloads. Agent calls execute_sql per file using:
 *   node scripts/mcp-import-runner.js --next
 *   node scripts/mcp-import-runner.js --file combined_01
 */
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/import-utils');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const FULL_DIR = path.join(__dirname, '../supabase/scripts/import_batches/_ca_combined');
const STATUS_PATH = path.join(__dirname, '../.import/ca_import_status.json');

function listFiles() {
  return fs
    .readdirSync(FULL_DIR)
    .filter((f) => /^combined_\d+\.sql$/.test(f))
    .sort();
}

function loadStatus() {
  if (!fs.existsSync(STATUS_PATH)) {
    return { before: 2778, ok: [], failed: [], errors: [] };
  }
  return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
}

function saveStatus(status) {
  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));
}

function fileKey(file) {
  return file.replace('.sql', '');
}

function getSql(file) {
  return fs.readFileSync(path.join(FULL_DIR, file), 'utf8');
}

function main() {
  const args = parseArgs(process.argv);
  const files = listFiles();
  const status = loadStatus();

  if (args.flags.has('list')) {
    console.log(JSON.stringify(files, null, 2));
    return;
  }

  if (args.flags.has('status')) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  if (args.flags.has('mark-ok')) {
    const key = args.options.file;
    if (!key) throw new Error('--mark-ok requires --file combined_XX');
    if (!status.ok.includes(key)) status.ok.push(key);
    saveStatus(status);
    console.log('marked ok', key);
    return;
  }

  if (args.flags.has('mark-fail')) {
    const key = args.options.file;
    const err = args.options.error || 'unknown';
    status.failed.push({ file: key, error: err });
    status.errors.push({ file: key, error: err });
    saveStatus(status);
    console.log('marked fail', key, err);
    return;
  }

  if (args.flags.has('next')) {
    const pending = files.find((f) => !status.ok.includes(fileKey(f)) && !status.failed.some((x) => x.file === fileKey(f)));
    if (!pending) {
      console.log(JSON.stringify({ done: true, status }, null, 2));
      return;
    }
    const key = fileKey(pending);
    const sql = getSql(pending);
    const out = path.join(__dirname, '../.import/mcp_query.sql');
    fs.writeFileSync(out, sql);
    console.log(
      JSON.stringify({
        project_id: PROJECT_ID,
        file: pending,
        key,
        bytes: sql.length,
        sql_path: out,
        pending: files.length - status.ok.length,
        ok_count: status.ok.length,
      })
    );
    return;
  }

  const key = args.options.file || (args.options._ && args.options._[0]);
  if (!key) {
    console.error('Usage: --list | --status | --next | --file combined_01 | --mark-ok --file X');
    process.exit(1);
  }

  const file = key.endsWith('.sql') ? key : `${key}.sql`;
  const sql = getSql(file);
  const out = path.join(__dirname, '../.import/mcp_query.sql');
  fs.writeFileSync(out, sql);
  console.log(
    JSON.stringify({ project_id: PROJECT_ID, file, key: fileKey(file), bytes: sql.length, sql_path: out })
  );
}

main();
