#!/usr/bin/env node
/**
 * Import SQL files using Supabase MCP execute_sql via Cursor agent bridge.
 * Reads each SQL file and prints MCP call metadata; actual execution requires
 * SUPABASE_ACCESS_TOKEN or agent CallMcpTool loop.
 *
 * When SUPABASE_ACCESS_TOKEN is set, executes directly via Management API.
 *
 * Usage:
 *   node scripts/import-chunks-mcp.js --dir supabase/scripts/import_batches/_ca_json_chunks
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
  const start = Number(args.options.start || 1);
  const end = args.options.end ? Number(args.options.end) : null;

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const slice = end ? files.slice(start - 1, end) : files.slice(start - 1);

  if (!token) {
    console.error(`Set SUPABASE_ACCESS_TOKEN to import ${slice.length} files from ${dir}`);
    process.exit(1);
  }

  let before = JSON.parse(await postSql(token, 'SELECT count(*)::int AS n FROM public.locations'))[0]?.n;
  console.log('Before:', before);

  for (let i = 0; i < slice.length; i += parallel) {
    const wave = slice.slice(i, i + parallel);
    await Promise.all(
      wave.map(async (file) => {
        const sql = fs.readFileSync(path.join(dir, file), 'utf8');
        process.stdout.write(`${file}… `);
        await postSql(token, sql);
        console.log('OK');
      })
    );
  }

  await postSql(token, 'ANALYZE public.locations;');
  const after = JSON.parse(await postSql(token, 'SELECT count(*)::int AS n FROM public.locations'))[0]?.n;
  console.log('After:', after, `(+${after - before})`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
