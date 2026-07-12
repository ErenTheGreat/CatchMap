#!/usr/bin/env node
/**
 * Prepare next wave of mini-chunk MCP execute_sql payloads.
 * Usage: node scripts/mcp-prepare-mini-wave.js [waveSize]
 * Output: .import/mcp_waves/wave_NNN.json with [{key, project_id, query}]
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const MINI_DIR = path.join(__dirname, '../.import/mini_chunks');
const MANIFEST = path.join(MINI_DIR, 'manifest.json');
const STATUS = path.join(__dirname, '../.import/ca_mini_status.json');
const WAVE_DIR = path.join(__dirname, '../.import/mcp_waves');

function pendingKeys() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const status = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
  const ok = new Set(status.ok);
  return manifest.mini.map((m) => m.key).sort().filter((k) => !ok.has(k));
}

function main() {
  const waveSize = Number(process.argv[2] || 8);
  const pending = pendingKeys();
  const wave = pending.slice(0, waveSize);
  fs.mkdirSync(WAVE_DIR, { recursive: true });

  const existing = fs.readdirSync(WAVE_DIR).filter((f) => /^wave_\d+\.json$/.test(f));
  const nextNum = existing.length;
  const outPath = path.join(WAVE_DIR, `wave_${String(nextNum).padStart(3, '0')}.json`);

  const payloads = wave.map((key) => ({
    key,
    project_id: PROJECT_ID,
    query: fs.readFileSync(path.join(MINI_DIR, `${key}.sql`), 'utf8'),
  }));

  fs.writeFileSync(outPath, JSON.stringify(payloads));
  console.log(
    JSON.stringify({
      out: outPath,
      count: payloads.length,
      keys: payloads.map((p) => p.key),
      pending_remaining: pending.length - wave.length,
    })
  );
}

main();
