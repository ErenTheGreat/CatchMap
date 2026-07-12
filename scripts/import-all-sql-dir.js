#!/usr/bin/env node
/**
 * Import all SQL chunk/combined files under a directory via Supabase Management API.
 * Mirrors run_parallel_import.py but works with _ca_combined/ or _json_chunks/.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/import-all-sql-dir.js --dir supabase/scripts/import_batches/_ca_combined
 */

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/import-utils');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;

async function executeSql(token, query) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  return text;
}

async function main() {
  const args = parseArgs(process.argv);
  const projectRoot = path.join(__dirname, '..');
  const dir = path.resolve(
    projectRoot,
    args.options.dir || 'supabase/scripts/import_batches/_ca_combined'
  );
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => path.join(dir, f));

  if (files.length === 0) {
    console.error(`No .sql files in ${dir}`);
    process.exit(1);
  }

  if (!token) {
    console.error('Set SUPABASE_ACCESS_TOKEN');
    console.error(`Found ${files.length} files to import in ${dir}`);
    process.exit(1);
  }

  let before = null;
  try {
    before = JSON.parse(await executeSql(token, 'SELECT count(*)::int AS n FROM public.locations;'))[0]?.n;
  } catch {
    // ignore
  }
  console.log('Before:', before);

  let ok = 0;
  for (const file of files) {
    const sql = fs.readFileSync(file, 'utf8');
    process.stdout.write(`${path.basename(file)}… `);
    try {
      await executeSql(token, sql);
      ok += 1;
      console.log('OK');
    } catch (error) {
      console.log('FAIL');
      console.error(error.message);
      process.exit(1);
    }
  }

  await executeSql(token, 'ANALYZE public.locations;');
  const after = JSON.parse(
    await executeSql(token, 'SELECT count(*)::int AS n FROM public.locations;')
  )[0]?.n;
  console.log('\nImported files:', ok);
  console.log('After:', after);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
