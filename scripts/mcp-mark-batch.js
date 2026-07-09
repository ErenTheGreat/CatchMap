#!/usr/bin/env node
/**
 * Mark a batch of keys ok after successful MCP import.
 * Usage: node scripts/mcp-mark-batch.js key1 key2 ...
 *        node scripts/mcp-mark-batch.js --last 8
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MANIFEST = path.join(__dirname, '../.import/mini_chunks/manifest.json');
const STATUS = path.join(__dirname, '../.import/ca_mini_status.json');
const RUNNER = path.join(__dirname, 'mcp-mini-chunk-runner.js');

function pendingKeys() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const status = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
  const ok = new Set(status.ok);
  return manifest.mini.map((m) => m.key).sort().filter((k) => !ok.has(k));
}

let keys = process.argv.slice(2);
const lastIdx = keys.indexOf('--last');
if (lastIdx >= 0) {
  const n = Number(keys[lastIdx + 1]) || 1;
  keys = pendingKeys().slice(0, n);
}

if (!keys.length) {
  console.log('No keys to mark');
  process.exit(0);
}

for (const key of keys) {
  spawnSync(process.execPath, [RUNNER, '--mark-ok', '--key', key], { stdio: 'inherit' });
}

console.log(JSON.stringify({ marked: keys.length, keys }));
