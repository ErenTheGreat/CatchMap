#!/usr/bin/env node
/**
 * Build INSERT SQL from JSON slice (stdout) for MCP / manual import.
 *
 * Usage:
 *   node scripts/build-insert-sql.js data/ca_waterbodies.json --offset 0 --limit 400
 */

const fs = require('fs');
const path = require('path');
const { buildInsertBatch, parseArgs } = require('./lib/import-utils');

function main() {
  const args = parseArgs(process.argv);
  const inputPath = args.options._?.[0];
  const offset = Number(args.options.offset || 0);
  const limit = Number(args.options.limit || 400);

  if (!inputPath) {
    console.error('Usage: node scripts/build-insert-sql.js <json> --offset N --limit M');
    process.exit(1);
  }

  const projectRoot = path.join(__dirname, '..');
  const absInput = path.isAbsolute(inputPath)
    ? inputPath
    : path.join(projectRoot, inputPath);

  const rows = JSON.parse(fs.readFileSync(absInput, 'utf8'));
  const slice = rows.slice(offset, offset + limit);
  if (slice.length === 0) {
    process.exit(0);
  }
  process.stdout.write(buildInsertBatch(slice));
}

main();
