#!/usr/bin/env node
/**
 * Split waterbody JSON into MCP-sized SQL chunk files.
 *
 * Usage:
 *   node scripts/prepare-json-chunks.js data/ca_waterbodies.json --out supabase/scripts/import_batches/_json_chunks --chunk 400
 *   node scripts/prepare-json-chunks.js data/us/great_lakes_waterbodies.json --out supabase/scripts/import_batches/great_lakes/_json_chunks
 */

const fs = require('fs');
const path = require('path');
const { buildInsertBatch, parseArgs } = require('./lib/import-utils');

function main() {
  const args = parseArgs(process.argv);
  const inputPath = args.options._?.[0];
  const chunkSize = Number(args.options.chunk || 400);
  const offset = Number(args.options.offset || 0);

  if (!inputPath) {
    console.error(
      'Usage: node scripts/prepare-json-chunks.js <json> --out <dir> [--chunk 400] [--offset 0]'
    );
    process.exit(1);
  }

  const projectRoot = path.join(__dirname, '..');
  const absInput = path.isAbsolute(inputPath)
    ? inputPath
    : path.join(projectRoot, inputPath);
  const outDir = path.resolve(
    projectRoot,
    args.options.out || 'supabase/scripts/import_batches/_json_chunks'
  );

  const rows = JSON.parse(fs.readFileSync(absInput, 'utf8'));
  const slice = rows.slice(offset);
  fs.mkdirSync(outDir, { recursive: true });

  let chunkNum = 1;
  for (let i = 0; i < slice.length; i += chunkSize) {
    const batch = slice.slice(i, i + chunkSize);
    const sql = buildInsertBatch(batch);
    const filename = `chunk_${String(chunkNum).padStart(4, '0')}.sql`;
    fs.writeFileSync(path.join(outDir, filename), sql.trim() + '\n');
    chunkNum += 1;
  }

  const manifest = {
    source: path.relative(projectRoot, absInput),
    offset,
    chunkSize,
    rows: slice.length,
    chunks: chunkNum - 1,
    outDir: path.relative(projectRoot, outDir),
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(outDir, '_manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );
  console.log(JSON.stringify(manifest, null, 2));
}

main();
