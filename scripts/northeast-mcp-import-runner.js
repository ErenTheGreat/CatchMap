#!/usr/bin/env node
/**
 * Northeast import runner for agent-driven MCP execute_sql waves.
 * Prints wave payloads as JSON; agent calls plugin-supabase-supabase execute_sql.
 *
 * Usage:
 *   node scripts/northeast-mcp-import-runner.js wave 0
 *   node scripts/northeast-mcp-import-runner.js mark-ok batch_000.sql
 *   node scripts/northeast-mcp-import-runner.js mark-fail batch_000.sql "error msg"
 *   node scripts/northeast-mcp-import-runner.js status
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const DIR = path.join(__dirname, '../.import/mcp_run/northeast');
const STATUS = path.join(DIR, '_import_status.json');
const PARALLEL = 3;

function loadStatus() {
  if (!fs.existsSync(STATUS)) {
    return { succeeded: [], errors: [], pending: listFiles() };
  }
  return JSON.parse(fs.readFileSync(STATUS, 'utf8'));
}

function saveStatus(s) {
  fs.writeFileSync(STATUS, JSON.stringify(s, null, 2));
}

function listFiles() {
  return fs
    .readdirSync(DIR)
    .filter((f) => /^batch_\d{3}\.sql$/.test(f))
    .sort();
}

function wavePayload(wave) {
  const files = listFiles();
  const slice = files.slice(wave * PARALLEL, wave * PARALLEL + PARALLEL);
  if (!slice.length) return { done: true, totalFiles: files.length };
  return {
    done: false,
    wave,
    totalFiles: files.length,
    project_id: PROJECT_ID,
    files: slice.map((file) => ({
      file,
      query: fs.readFileSync(path.join(DIR, file), 'utf8'),
    })),
  };
}

function main() {
  const [cmd, arg1, ...rest] = process.argv.slice(2);
  if (cmd === 'wave') {
    console.log(JSON.stringify(wavePayload(Number(arg1 || 0))));
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
        failed: (s.errors || []).length,
        pending: total - s.succeeded.length,
        errors: s.errors || [],
        succeeded_files: s.succeeded,
      })
    );
    return;
  }
  console.error('Commands: wave <n> | mark-ok <file> | mark-fail <file> <err> | status');
  process.exit(2);
}

main();
