#!/usr/bin/env node
/**
 * Generate SQL import batches from waterbody JSON.
 *
 * Usage (from project/):
 *   node scripts/generate-import-batches.js data/us/great_lakes_waterbodies.json
 *   node scripts/generate-import-batches.js data/ca_waterbodies.json --out supabase/scripts/import_batches
 *   node scripts/generate-import-batches.js data/us/great_lakes_waterbodies.json --out supabase/scripts/import_batches/great_lakes --prefix batch
 */

const fs = require('fs');
const path = require('path');
const { buildInsertBatch, parseArgs } = require('./lib/import-utils');

const ROWS_PER_BATCH = 500;

function main() {
  const args = parseArgs(process.argv);
  const inputPath = args.options._?.[0];
  if (!inputPath) {
    console.error(
      'Usage: node scripts/generate-import-batches.js <json-path> [--out dir] [--prefix batch]'
    );
    process.exit(1);
  }

  const projectRoot = path.join(__dirname, '..');
  const absInput = path.isAbsolute(inputPath)
    ? inputPath
    : path.join(projectRoot, inputPath);
  const outDir = path.resolve(
    projectRoot,
    args.options.out || 'supabase/scripts/import_batches'
  );
  const prefix = args.options.prefix || 'batch';

  const rows = JSON.parse(fs.readFileSync(absInput, 'utf8'));
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error('Input JSON must be a non-empty array');
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  let batchNum = 1;
  let totalFiles = 0;
  for (let i = 0; i < rows.length; i += ROWS_PER_BATCH) {
    const batch = rows.slice(i, i + ROWS_PER_BATCH);
    const sql = buildInsertBatch(batch);
    const filename = `${prefix}_${String(batchNum).padStart(3, '0')}.sql`;
    fs.writeFileSync(path.join(outDir, filename), sql.trim() + '\n');
    console.log(`Wrote ${filename} (${batch.length} rows)`);
    batchNum += 1;
    totalFiles += 1;
  }

  const manifest = {
    source: path.relative(projectRoot, absInput),
    outDir: path.relative(projectRoot, outDir),
    rows: rows.length,
    batches: totalFiles,
    rowsPerBatch: ROWS_PER_BATCH,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(outDir, '_manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );
  console.log(`\nGenerated ${totalFiles} batches (${rows.length} rows) -> ${outDir}`);
}

main();
