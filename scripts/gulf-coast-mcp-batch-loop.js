#!/usr/bin/env node
/**
 * Gulf Coast MCP batch import loop helper.
 * Reads batch SQL from disk and prints wave payloads for agent CallMcpTool.
 *
 * Usage:
 *   node scripts/gulf-coast-mcp-batch-loop.js wave 0
 *   node scripts/gulf-coast-mcp-batch-loop.js mark-ok batch_000.sql
 *   node scripts/gulf-coast-mcp-batch-loop.js mark-fail batch_000.sql "error"
 *   node scripts/gulf-coast-mcp-batch-loop.js status
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const DIR = path.join(__dirname, '../.import/mcp_run/gulf_coast');
const STATUS = path.join(DIR, '_import_status.json');
const PARALLEL = 3;

function listFiles() {
  return fs
    .readdirSync(DIR)
    .filter((f) => /^batch_\d{3}\.sql$/.test(f))
    .sort();
}

function loadStatus() {
  if (!fs.existsSync(STATUS)) {
    return { succeeded: [], errors: [], pending: listFiles() };
  }
  return JSON.parse(fs.readFileSync(STATUS, 'utf8'));
}

function saveStatus(s) {
  fs.writeFileSync(STATUS, JSON.stringify(s, null, 2));
}

function readSql(file) {
  return fs.readFileSync(path.join(DIR, file), 'utf8');
}

function wavePayload(wave) {
  const files = listFiles();
  const status = loadStatus();
  const pending = files.filter((f) => !status.succeeded.includes(f));
  const slice = pending.slice(wave * PARALLEL, wave * PARALLEL + PARALLEL);
  if (!slice.length) {
    return { done: true, totalFiles: files.length, succeeded: status.succeeded.length, errors: status.errors };
  }
  return {
    done: false,
    wave,
    totalFiles: files.length,
    pending: pending.length,
    project_id: PROJECT_ID,
    files: slice.map((file) => ({
      file,
      query: readSql(file),
      args_file: path.join(DIR, `_exec_payload_${file.replace('batch_', '').replace('.sql', '')}.json`),
    })),
  };
}

function main() {
  const [cmd, arg1, ...rest] = process.argv.slice(2);
  if (cmd === 'wave') {
    const payload = wavePayload(Number(arg1 || 0));
    // also write per-file MCP arg JSON for agent
    if (!payload.done) {
      for (const item of payload.files) {
        const n = item.file.replace('batch_', '').replace('.sql', '');
        fs.writeFileSync(
          path.join(DIR, `_mcp_args_${n}.json`),
          JSON.stringify({ project_id: PROJECT_ID, query: item.query })
        );
      }
    }
    console.log(JSON.stringify(payload));
    return;
  }
  if (cmd === 'mark-ok') {
    const s = loadStatus();
    if (!s.succeeded.includes(arg1)) s.succeeded.push(arg1);
    s.pending = (s.pending || listFiles()).filter((f) => f !== arg1);
    s.errors = (s.errors || []).filter((e) => e.file !== arg1);
    saveStatus(s);
    console.log(JSON.stringify({ ok: true, file: arg1, succeeded: s.succeeded.length }));
    return;
  }
  if (cmd === 'mark-fail') {
    const s = loadStatus();
    const err = { file: arg1, error: rest.join(' ') || 'unknown error' };
    s.errors = [...(s.errors || []).filter((e) => e.file !== arg1), err];
    saveStatus(s);
    console.log(JSON.stringify({ ok: false, ...err }));
    return;
  }
  if (cmd === 'status') {
    const s = loadStatus();
    const total = listFiles().length;
    console.log(
      JSON.stringify({
        total,
        succeeded: s.succeeded.length,
        errors: s.errors || [],
        pending: total - s.succeeded.length,
      })
    );
    return;
  }
  console.error('Usage: wave N | mark-ok FILE | mark-fail FILE MSG | status');
  process.exit(2);
}

if (require.main === module) main();

module.exports = { wavePayload, loadStatus, saveStatus, listFiles, PROJECT_ID, DIR };
