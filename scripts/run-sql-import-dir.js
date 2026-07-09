#!/usr/bin/env node
/**
 * Execute SQL files via Supabase MCP-style Management API using Cursor plugin auth fallback.
 * When SUPABASE_ACCESS_TOKEN is unset, prints file list for manual MCP import.
 *
 * This script is the automation entrypoint for bulk location imports.
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
  const dir = path.resolve(projectRoot, args.options.dir);
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (!token) {
    console.log(JSON.stringify({ dir, files, note: 'Set SUPABASE_ACCESS_TOKEN to import' }, null, 2));
    process.exit(0);
  }

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`Importing ${file} (${sql.length} bytes)…`);
    await postSql(token, sql);
    console.log('  OK');
  }

  await postSql(token, 'ANALYZE public.locations;');
  const count = JSON.parse(await postSql(token, 'SELECT count(*)::int AS n FROM public.locations'))[0]?.n;
  console.log('Total locations:', count);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
