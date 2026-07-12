#!/usr/bin/env node
/** Emit INSERT SQL for one batch slice of a waterbody JSON file. */
const fs = require('fs');
const path = require('path');
const { buildInsertBatch, parseArgs } = require('./lib/import-utils');

const args = parseArgs(process.argv);
const inputPath = args.options._?.[0];
const batchIndex = Number(args.options.batch ?? 0);
const batchSize = Number(args.options.size ?? 300);

if (!inputPath) {
  console.error('Usage: node scripts/emit-json-batch-sql.js <json> --batch N [--size 300]');
  process.exit(2);
}

const projectRoot = path.join(__dirname, '..');
const absInput = path.isAbsolute(inputPath) ? inputPath : path.join(projectRoot, inputPath);
const rows = JSON.parse(fs.readFileSync(absInput, 'utf8'));
const start = batchIndex * batchSize;
const batch = rows.slice(start, start + batchSize);
if (batch.length === 0) process.exit(3);
process.stdout.write(buildInsertBatch(batch));
