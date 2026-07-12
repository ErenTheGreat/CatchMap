#!/usr/bin/env node
/**
 * Track mini-chunk MCP import progress.
 *
 * Usage:
 *   node scripts/mcp-mini-chunk-runner.js --status
 *   node scripts/mcp-mini-chunk-runner.js --next
 *   node scripts/mcp-mini-chunk-runner.js --mark-ok combined_01_p0__m00
 *   node scripts/mcp-mini-chunk-runner.js --mark-fail KEY --error "msg"
 *   node scripts/mcp-mini-chunk-runner.js --parents-done
 */
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/import-utils');

const OUT_DIR = path.join(__dirname, '../.import/mini_chunks');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');
const STATUS = path.join(__dirname, '../.import/ca_mini_status.json');
const CHUNK_STATUS = path.join(__dirname, '../.import/ca_chunk_status.json');

function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
}

function loadStatus() {
  if (!fs.existsSync(STATUS)) {
    return { before: 2778, ok: [], failed: [], errors: [], parents_ok: [] };
  }
  return JSON.parse(fs.readFileSync(STATUS, 'utf8'));
}

function saveStatus(s) {
  fs.mkdirSync(path.dirname(STATUS), { recursive: true });
  fs.writeFileSync(STATUS, JSON.stringify(s, null, 2));
}

function parentKey(miniKey) {
  return miniKey.replace(/__m\d+$/, '');
}

function maybeMarkParents(status, manifest) {
  const byParent = {};
  for (const m of manifest.mini) {
    if (!byParent[m.parent]) byParent[m.parent] = [];
    if (!byParent[m.parent].includes(m.key)) byParent[m.parent].push(m.key);
  }
  for (const [parent, keys] of Object.entries(byParent)) {
    if (keys.every((k) => status.ok.includes(k)) && !status.parents_ok.includes(parent)) {
      status.parents_ok.push(parent);
    }
  }
}

function main() {
  const args = parseArgs(process.argv);
  const manifest = loadManifest();
  const status = loadStatus();
  const allKeys = manifest.mini.map((m) => m.key).sort();

  if (args.flags.has('status')) {
    const pending = allKeys.filter((k) => !status.ok.includes(k));
    console.log(
      JSON.stringify(
        {
          ...status,
          total_mini: allKeys.length,
          pending_mini: pending.length,
          next_mini: pending[0] || null,
          parents_done: status.parents_ok.length,
        },
        null,
        2
      )
    );
    return;
  }

  if (args.flags.has('mark-ok')) {
    const key = args.options.key || args.positional[0];
    if (!status.ok.includes(key)) status.ok.push(key);
    maybeMarkParents(status, manifest);
    saveStatus(status);
    console.log('ok', key);
    return;
  }

  if (args.flags.has('mark-fail')) {
    const key = args.options.key || args.positional[0];
    const err = args.options.error || 'unknown';
    status.failed.push({ key, error: err });
    status.errors.push({ key, error: err });
    saveStatus(status);
    console.log('fail', key, err);
    return;
  }

  if (args.flags.has('next')) {
    const pending = allKeys.filter((k) => !status.ok.includes(k));
    if (!pending.length) {
      console.log(JSON.stringify({ done: true, status }));
      return;
    }
    const key = pending[0];
    const sql = fs.readFileSync(path.join(OUT_DIR, `${key}.sql`), 'utf8');
    const out = path.join(OUT_DIR, `_next_${key}.json`);
    fs.writeFileSync(
      out,
      JSON.stringify({ project_id: 'cpzwvlpqdzjjsdlnmfgg', query: sql, key, bytes: sql.length })
    );
    console.log(JSON.stringify({ key, parent: parentKey(key), bytes: sql.length, out, pending: pending.length }));
    return;
  }

  if (args.flags.has('parents-done')) {
    maybeMarkParents(status, manifest);
    saveStatus(status);
    // sync chunk status
    const chunkStatus = {
      before: status.before,
      chunks_ok: status.parents_ok,
      files_ok: [...new Set(status.parents_ok.map((k) => k.replace(/_p\d+$/, '')))].sort(),
      failed: status.failed,
      errors: status.errors,
    };
    fs.writeFileSync(CHUNK_STATUS, JSON.stringify(chunkStatus, null, 2));
    console.log(JSON.stringify(chunkStatus, null, 2));
    return;
  }

  console.error('Usage: --status|--next|--mark-ok KEY|--mark-fail KEY|--parents-done');
  process.exit(1);
}

main();
