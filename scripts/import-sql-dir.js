#!/usr/bin/env node
/**
 * Import SQL files from a directory via Supabase Management API.
 * Falls back to printing file list when SUPABASE_ACCESS_TOKEN is unset.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/import-sql-dir.js --dir supabase/scripts/import_batches/_ca_combined
 *   node scripts/import-sql-dir.js --dir supabase/scripts/import_batches/great_lakes/_chunks
 */

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/import-utils');

const API_URL = 'https://api.supabase.com/v1/projects/cpzwvlpqdzjjsdlnmfgg/database/query';

async function postSql(token, query) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${text.slice(0, 400)}`);
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
  const parallel = Number(args.options.parallel || 2);
  const analyze = !args.flags.has('no-analyze');

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.error(`No .sql files in ${dir}`);
    process.exit(1);
  }

  if (!token) {
    console.error('Set SUPABASE_ACCESS_TOKEN to import via Management API.');
    console.error(`Ready: ${files.length} files in ${dir}`);
    process.exit(1);
  }

  let before = null;
  try {
    before = JSON.parse(await postSql(token, 'SELECT count(*)::int AS n FROM public.locations'))[0]?.n;
  } catch {
    // ignore
  }
  console.log('Before:', before);

  for (let i = 0; i < files.length; i += parallel) {
    const wave = files.slice(i, i + parallel);
    await Promise.all(
      wave.map(async (file) => {
        const sql = fs.readFileSync(path.join(dir, file), 'utf8');
        process.stdout.write(`${file} (${sql.length} bytes)… `);
        await postSql(token, sql);
        console.log('OK');
      })
    );
  }

  if (analyze) {
    await postSql(token, 'ANALYZE public.locations;');
  }

  const after = JSON.parse(
    await postSql(token, 'SELECT count(*)::int AS n FROM public.locations')
  )[0]?.n;
  console.log('After:', after, `(+${(after ?? 0) - (before ?? 0)})`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
