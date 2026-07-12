#!/usr/bin/env node
/**
 * Execute SQL batch files against Supabase Postgres.
 *
 * Usage (from project/):
 *   node scripts/run-import-batches.js --dir supabase/scripts/import_batches --start 2 --end 35
 *   node scripts/run-import-batches.js --dir supabase/scripts/import_batches/great_lakes
 *
 * Requires SUPABASE_DB_PASSWORD in .env
 */

const fs = require('fs');
const path = require('path');
const { loadEnv, connectPg, parseArgs } = require('./lib/import-utils');

function listBatchFiles(dir, start, end) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^batch_\d+\.sql$/.test(f))
    .sort();

  return files.filter((f) => {
    const num = Number(f.match(/^batch_(\d+)\.sql$/)[1]);
    if (start != null && num < start) return false;
    if (end != null && num > end) return false;
    return true;
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const projectRoot = path.join(__dirname, '..');
  const dir = path.resolve(projectRoot, args.options.dir || 'supabase/scripts/import_batches');
  const start = args.options.start ? Number(args.options.start) : null;
  const end = args.options.end ? Number(args.options.end) : null;

  const { projectRef, password } = loadEnv(projectRoot);
  if (!password) {
    console.error('Set SUPABASE_DB_PASSWORD in .env');
    process.exit(1);
  }

  const files = listBatchFiles(dir, start, end);
  if (files.length === 0) {
    console.error(`No batch files found in ${dir}`);
    process.exit(1);
  }

  console.log(`Running ${files.length} batches from ${dir}`);
  const client = await connectPg(projectRef, password);
  let insertedApprox = 0;

  try {
    const before = await client.query('SELECT count(*)::int AS n FROM public.locations');
    console.log('Before:', before.rows[0]?.n);

    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      const result = await client.query(sql);
      insertedApprox += result.rowCount ?? 0;
      console.log(`${file}: +${result.rowCount ?? 0}`);
    }

    await client.query('ANALYZE public.locations');
    const after = await client.query('SELECT count(*)::int AS n FROM public.locations');
    console.log('\nDone. Approx new rows:', insertedApprox);
    console.log('After:', after.rows[0]?.n);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Batch import failed:', error.message);
  process.exit(1);
});
