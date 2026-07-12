#!/usr/bin/env node
/**
 * Execute SQL chunk/batch files via Supabase Management API (same as run_parallel_import.py).
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/execute-sql-via-api.js --file path/to.sql
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/execute-sql-via-api.js --dir supabase/scripts/import_batches/_chunks --glob 'batch_00*_chunk_*.sql'
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/execute-sql-via-api.js --dir supabase/scripts/import_batches --start 2 --end 35
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

function listFiles(args) {
  if (args.options.file) {
    return [path.resolve(args.options.file)];
  }
  const dir = path.resolve(args.options.dir || 'supabase/scripts/import_batches');
  const glob = args.options.glob || 'batch_*.sql';
  const re = new RegExp(
    '^' + glob.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
  );
  const start = args.options.start ? Number(args.options.start) : null;
  const end = args.options.end ? Number(args.options.end) : null;

  return fs
    .readdirSync(dir)
    .filter((f) => re.test(f))
    .filter((f) => {
      const m = f.match(/batch_(\d+)/);
      if (!m) return true;
      const n = Number(m[1]);
      if (start != null && n < start) return false;
      if (end != null && n > end) return false;
      return true;
    })
    .sort()
    .map((f) => path.join(dir, f));
}

async function main() {
  const args = parseArgs(process.argv);
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  if (!token) {
    console.error('Set SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens)');
    process.exit(1);
  }

  const files = listFiles(args);
  if (files.length === 0) {
    console.error('No SQL files matched');
    process.exit(1);
  }

  console.log(`Executing ${files.length} SQL file(s)…`);
  let ok = 0;
  const errors = [];

  for (const file of files) {
    const sql = fs.readFileSync(file, 'utf8');
    process.stdout.write(`${path.basename(file)}… `);
    try {
      await executeSql(token, sql);
      ok += 1;
      console.log('OK');
    } catch (error) {
      errors.push({ file: path.basename(file), error: error.message });
      console.log('FAIL');
      console.error(error.message);
    }
  }

  try {
    await executeSql(token, 'ANALYZE public.locations;');
    const countRaw = await executeSql(
      token,
      'SELECT count(*)::int AS n FROM public.locations;'
    );
    console.log('\nDone:', { ok, failed: errors.length, count: countRaw });
  } catch (error) {
    console.error('Post-analyze failed:', error.message);
  }

  if (errors.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
