#!/usr/bin/env node
/**
 * Import CA waterbodies from bundled JSON via chunked SQL (for MCP / manual runs).
 * Generates and optionally executes INSERT batches from data/ca_waterbodies.json.
 *
 * Usage:
 *   node scripts/import-ca-from-json.js --generate-only
 *   node scripts/import-ca-from-json.js --start-batch 2 --end-batch 35
 */

const fs = require('fs');
const path = require('path');
const { buildInsertBatch, loadEnv, connectPg, parseArgs } = require('./lib/import-utils');

const INSERT_BATCH = 400;

async function main() {
  const args = parseArgs(process.argv);
  const projectRoot = path.join(__dirname, '..');
  const jsonPath = path.join(projectRoot, 'data', 'ca_waterbodies.json');
  const rows = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const startBatch = Number(args.options['start-batch'] || 1);
  const endBatch = Number(args.options['end-batch'] || 999);
  const generateOnly = args.flags.has('generate-only');

  const batchDir = path.join(projectRoot, 'supabase/scripts/import_batches');
  const startIdx = (startBatch - 1) * 500;
  const endIdx = Math.min(endBatch * 500, rows.length);

  if (generateOnly) {
    console.log(`Source rows: ${rows.length} (already have batch_001..035 SQL)`);
    return;
  }

  const { projectRef, password } = loadEnv(projectRoot);
  if (!password) {
    console.error('Set SUPABASE_DB_PASSWORD in .env for direct import');
    process.exit(1);
  }

  const slice = rows.slice(startIdx, endIdx);
  console.log(`Importing rows ${startIdx}-${endIdx} (${slice.length} rows)`);

  const client = await connectPg(projectRef, password);
  let insertedApprox = 0;
  try {
    const before = await client.query('SELECT count(*)::int AS n FROM public.locations');
    console.log('Before:', before.rows[0]?.n);

    for (let i = 0; i < slice.length; i += INSERT_BATCH) {
      const batch = slice.slice(i, i + INSERT_BATCH);
      const sql = buildInsertBatch(batch);
      const result = await client.query(sql);
      insertedApprox += result.rowCount ?? 0;
      console.log(
        `Batch ${Math.floor(i / INSERT_BATCH) + 1}/${Math.ceil(slice.length / INSERT_BATCH)} (+${result.rowCount ?? 0})`
      );
    }

    await client.query('ANALYZE public.locations');
    const after = await client.query('SELECT count(*)::int AS n FROM public.locations');
    console.log('Approx new rows:', insertedApprox);
    console.log('After:', after.rows[0]?.n);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
