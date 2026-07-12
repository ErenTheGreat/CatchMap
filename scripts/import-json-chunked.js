#!/usr/bin/env node
/**
 * Split waterbody JSON into smaller SQL chunk files for MCP import.
 * Usage: node scripts/import-json-chunked.js data/us/gulf_coast_waterbodies.json --out supabase/scripts/import_batches/gulf_coast/_chunks --size 100
 */
const fs = require('fs');
const path = require('path');
const { buildInsertBatch, parseArgs } = require('./lib/import-utils');

function main() {
  const args = parseArgs(process.argv);
  const inputPath = args.options._?.[0];
  if (!inputPath) {
    console.error('Usage: node scripts/import-json-chunked.js <json> [--out dir] [--size N]');
    process.exit(1);
  }
  const projectRoot = path.join(__dirname, '..');
  const absInput = path.isAbsolute(inputPath) ? inputPath : path.join(projectRoot, inputPath);
  const outDir = path.resolve(projectRoot, args.options.out || 'supabase/scripts/import_batches/_chunks');
  const size = Number(args.options.size || 100);
  const rows = JSON.parse(fs.readFileSync(absInput, 'utf8'));
  fs.mkdirSync(outDir, { recursive: true });
  let chunkNum = 1;
  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size);
    const sql = buildInsertBatch(batch);
    const name = `chunk_${String(chunkNum).padStart(3, '0')}.sql`;
    fs.writeFileSync(path.join(outDir, name), sql.trim() + '\n');
    console.log(`Wrote ${name} (${batch.length} rows, ${sql.length} bytes)`);
    chunkNum++;
  }
  console.log(`Done: ${chunkNum - 1} chunks in ${outDir}`);
}

main();
