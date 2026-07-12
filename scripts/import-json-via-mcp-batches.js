#!/usr/bin/env node
/**
 * Import waterbody JSON via Supabase MCP-style batches (stdout JSON lines for agent/MCP).
 * Generates INSERT SQL in 200-row chunks from any regional JSON catalog.
 *
 * Usage:
 *   node scripts/import-json-via-mcp-batches.js data/ca_waterbodies.json --offset 500
 *   node scripts/import-json-via-mcp-batches.js data/us/great_lakes_waterbodies.json
 */

const fs = require('fs');
const path = require('path');
const { buildInsertBatch, parseArgs } = require('./lib/import-utils');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const ROWS_PER_BATCH = 200;

function main() {
  const args = parseArgs(process.argv);
  const inputPath = args.options._?.[0];
  if (!inputPath) {
    console.error('Usage: node scripts/import-json-via-mcp-batches.js <json> [--offset N] [--limit N]');
    process.exit(1);
  }

  const projectRoot = path.join(__dirname, '..');
  const absInput = path.isAbsolute(inputPath)
    ? inputPath
    : path.join(projectRoot, inputPath);
  const offset = Number(args.options.offset || 0);
  const limit = args.options.limit ? Number(args.options.limit) : null;

  let rows = JSON.parse(fs.readFileSync(absInput, 'utf8'));
  rows = rows.slice(offset, limit ? offset + limit : undefined);

  const outDir = path.resolve(
    projectRoot,
    args.options.out ||
      `supabase/scripts/import_batches/_mcp_json/${path.basename(absInput, '.json')}`
  );
  fs.mkdirSync(outDir, { recursive: true });

  let batchNum = 1;
  for (let i = 0; i < rows.length; i += ROWS_PER_BATCH) {
    const batch = rows.slice(i, i + ROWS_PER_BATCH);
    const sql = buildInsertBatch(batch);
    const payload = { project_id: PROJECT_ID, query: sql, _file: `batch_${String(batchNum).padStart(4, '0')}.sql` };
    const outPath = path.join(outDir, payload._file.replace('.sql', '.json'));
    fs.writeFileSync(outPath, JSON.stringify(payload));
    console.log(`Wrote ${outPath} (${batch.length} rows)`);
    batchNum += 1;
  }

  console.log(`\nPrepared ${batchNum - 1} MCP payloads in ${outDir}`);
}

main();
