#!/usr/bin/env node
/**
 * Import all SQL chunk files via Supabase Management API.
 * Uses SUPABASE_ACCESS_TOKEN from environment.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/import-all-chunks.js
 *   node scripts/import-all-chunks.js --dir supabase/scripts/import_batches/_ca_json_chunks
 */

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/import-utils');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;

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
    args.options.dir || 'supabase/scripts/import_batches/_ca_json_chunks'
  );
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  const parallel = Number(args.options.parallel || 4);

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (!token) {
    console.error(`Set SUPABASE_ACCESS_TOKEN to import ${files.length} files`);
    process.exit(1);
  }

  const before = JSON.parse(await postSql(token, 'SELECT count(*)::int AS n FROM public.locations'))[0]?.n;
  console.log('Before:', before);

  const errors = [];
  for (let i = 0; i < files.length; i += parallel) {
    const wave = files.slice(i, i + parallel);
    await Promise.all(
      wave.map(async (file) => {
        const sql = fs.readFileSync(path.join(dir, file), 'utf8');
        process.stdout.write(`${file}… `);
        try {
          await postSql(token, sql);
          console.log('OK');
        } catch (error) {
          errors.push({ file, error: error.message });
          console.log('FAIL');
        }
      })
    );
  }

  await postSql(token, 'ANALYZE public.locations;');
  const after = JSON.parse(await postSql(token, 'SELECT count(*)::int AS n FROM public.locations'))[0]?.n;
  const report = {
    before,
    after,
    added: after - before,
    files: files.length,
    errors,
    completedAt: new Date().toISOString(),
  };
  const outPath = path.join(dir, '_import_result.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
