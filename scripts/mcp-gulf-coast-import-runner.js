#!/usr/bin/env node
/**
 * Emit one wave of Gulf Coast batch SQL for plugin-supabase-supabase execute_sql.
 * Agent reads stdout JSON and calls CallMcpTool per payload.
 *
 * Usage:
 *   node scripts/mcp-gulf-coast-import-runner.js --wave 0
 *   node scripts/mcp-gulf-coast-import-runner.js --all
 */
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/import-utils');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const BATCH_DIR = path.join(__dirname, '../.import/mcp_run/gulf_coast');
const PARALLEL = 3;
const STATUS_FILE = path.join(BATCH_DIR, '_import_status.json');

function listBatches() {
  return fs
    .readdirSync(BATCH_DIR)
    .filter((f) => /^batch_\d{3}\.sql$/.test(f))
    .sort();
}

function readSql(file) {
  const p = path.join(BATCH_DIR, file);
  return fs.readFileSync(p, 'utf8');
}

function loadStatus() {
  if (!fs.existsSync(STATUS_FILE)) return { succeeded: [], errors: [] };
  return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
}

function saveStatus(status) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
}

function main() {
  const args = parseArgs(process.argv);
  const files = listBatches();
  const status = loadStatus();

  if (args.options.all) {
    const pending = files.filter((f) => !status.succeeded.includes(f));
    console.log(
      JSON.stringify({
        mode: 'all',
        total: files.length,
        pending: pending.length,
        files: pending,
        succeeded: status.succeeded.length,
        errors: status.errors,
      })
    );
    return;
  }

  const wave = Number(args.options.wave ?? 0);
  const pending = files.filter((f) => !status.succeeded.includes(f));
  const slice = pending.slice(0, PARALLEL);

  if (slice.length === 0) {
    console.log(JSON.stringify({ done: true, total: files.length, status }));
    return;
  }

  const payloads = slice.map((file) => ({
    project_id: PROJECT_ID,
    file,
    query: readSql(file),
  }));

  console.log(
    JSON.stringify({
      done: false,
      wave,
      total: files.length,
      pending: pending.length,
      files: slice,
      payloads,
      status,
    })
  );
}

if (require.main === module) main();

module.exports = { listBatches, readSql, loadStatus, saveStatus, BATCH_DIR, PROJECT_ID };
