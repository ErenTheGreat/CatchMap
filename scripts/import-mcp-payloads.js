#!/usr/bin/env node
/**
 * Import MCP payload JSON files via Supabase Management API.
 * Reads payloads from scripts/prepare-mcp-payloads.js output.
 *
 * Usage:
 *   node scripts/import-mcp-payloads.js --dir supabase/scripts/import_batches/_mcp_exec
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
    args.options.dir || 'supabase/scripts/import_batches/_mcp_exec'
  );
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  const start = Number(args.options.start || 1);
  const end = args.options.end ? Number(args.options.end) : null;

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  const slice = end
    ? files.slice(start - 1, end)
    : files.slice(start - 1);

  if (!token) {
    console.error('Set SUPABASE_ACCESS_TOKEN');
    console.error(`${slice.length} payloads in ${dir} (from ${files[start - 1]})`);
    process.exit(1);
  }

  let before = null;
  try {
    before = JSON.parse(await postSql(token, 'SELECT count(*)::int AS n FROM public.locations'))[0]?.n;
  } catch {
    // ignore
  }
  console.log('Before:', before);

  for (const file of slice) {
    const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    process.stdout.write(`${file}… `);
    await postSql(token, payload.query);
    console.log('OK');
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
