#!/usr/bin/env node
/**
 * Import SQL batch files via Supabase Management API.
 * Falls back to emitting file list when SUPABASE_ACCESS_TOKEN is unset.
 *
 * Usage:
 *   node scripts/mcp-import-sql-batches.js --dir supabase/scripts/import_batches/gulf_coast --pattern 'batch_*.sql'
 *   node scripts/mcp-import-sql-batches.js --dir supabase/scripts/import_batches/northeast --pattern 'batch_*.sql'
 */
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/import-utils');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function executeSql(token, query, attempt = 0) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (res.status === 429 && attempt < 6) {
    const waitMs = Math.min(30000, 2000 * 2 ** attempt);
    console.error(`rate limited on attempt ${attempt + 1}, retry in ${waitMs / 1000}s`);
    await sleep(waitMs);
    return executeSql(token, query, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  return text;
}

function listFiles(dir, pattern) {
  const re = new RegExp(
    '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
  );
  return fs
    .readdirSync(dir)
    .filter((f) => re.test(f))
    .sort();
}

async function main() {
  const args = parseArgs(process.argv);
  const projectRoot = path.join(__dirname, '..');
  const dir = path.resolve(projectRoot, args.options.dir || '.');
  const pattern = args.options.pattern || 'batch_*.sql';
  const parallel = Number(args.options.parallel || 3);
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;

  const files = listFiles(dir, pattern);
  if (files.length === 0) {
    console.error(`No files matching ${pattern} in ${dir}`);
    process.exit(1);
  }

  if (!token) {
    console.error(`Set SUPABASE_ACCESS_TOKEN to import ${files.length} files from ${dir}`);
    console.error('Files:', files.join(', '));
    process.exit(1);
  }

  const countSql = `SELECT count(*)::int AS total,
    count(*) FILTER (WHERE ST_Intersects(coordinates, ST_MakeEnvelope(-97.5, 24, -80, 35, 4326)::geography)) AS gulf_coast,
    count(*) FILTER (WHERE ST_Intersects(coordinates, ST_MakeEnvelope(-80, 36, -66, 47.5, 4326)::geography)) AS northeast
    FROM public.locations;`;

  const before = JSON.parse(await executeSql(token, countSql))[0];
  console.log('Before:', before);

  const results = [];
  for (let i = 0; i < files.length; i += parallel) {
    const wave = files.slice(i, i + parallel);
    const waveResults = await Promise.all(
      wave.map(async (file) => {
        const sql = fs.readFileSync(path.join(dir, file), 'utf8');
        process.stdout.write(`${file} (${sql.length} bytes)… `);
        try {
          await executeSql(token, sql);
          console.log('OK');
          return { file, ok: true };
        } catch (err) {
          console.log('FAIL');
          return { file, ok: false, error: String(err.message || err) };
        }
      })
    );
    results.push(...waveResults);
  }

  await executeSql(token, 'ANALYZE public.locations;');
  const after = JSON.parse(await executeSql(token, countSql))[0];
  console.log('After:', after);
  console.log(`Delta total: +${after.total - before.total}`);

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error('Failed:', failed);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
