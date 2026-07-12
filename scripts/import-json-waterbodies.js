#!/usr/bin/env node
/**
 * Import waterbody JSON into public.locations (direct Postgres).
 * Used for CA bundled JSON and any regional catalog.
 *
 * Usage:
 *   node scripts/import-json-waterbodies.js data/ca_waterbodies.json
 *   node scripts/import-json-waterbodies.js data/us/great_lakes_waterbodies.json
 */

const fs = require('fs');
const path = require('path');
const { buildInsertBatch, loadEnv, connectPg, parseArgs } = require('./lib/import-utils');

const INSERT_BATCH = 400;

async function main() {
  const args = parseArgs(process.argv);
  const inputPath = args.options._?.[0];
  if (!inputPath) {
    console.error('Usage: node scripts/import-json-waterbodies.js <json-path>');
    process.exit(1);
  }

  const projectRoot = path.join(__dirname, '..');
  const absInput = path.isAbsolute(inputPath)
    ? inputPath
    : path.join(projectRoot, inputPath);

  const rows = JSON.parse(fs.readFileSync(absInput, 'utf8'));
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error('Input JSON must be a non-empty array');
    process.exit(1);
  }

  const { projectRef, password } = loadEnv(projectRoot);
  if (!password) {
    console.error('Set SUPABASE_DB_PASSWORD in .env');
    process.exit(1);
  }

  console.log(`Importing ${rows.length} rows from ${absInput}`);
  const client = await connectPg(projectRef, password);
  let insertedApprox = 0;

  try {
    const before = await client.query('SELECT count(*)::int AS n FROM public.locations');
    console.log('Before:', before.rows[0]?.n);

    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const batch = rows.slice(i, i + INSERT_BATCH);
      const sql = buildInsertBatch(batch);
      const result = await client.query(sql);
      insertedApprox += result.rowCount ?? 0;
      console.log(
        `Batch ${Math.floor(i / INSERT_BATCH) + 1}/${Math.ceil(rows.length / INSERT_BATCH)} (+${result.rowCount ?? 0})`
      );
    }

    await client.query('ANALYZE public.locations');
    const after = await client.query('SELECT count(*)::int AS n FROM public.locations');
    console.log('\nImport complete. Approx new rows:', insertedApprox);
    console.log('After:', after.rows[0]?.n);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Import failed:', error.message);
  process.exit(1);
});
