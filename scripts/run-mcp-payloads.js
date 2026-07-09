#!/usr/bin/env node
/**
 * Execute MCP payload JSON files via Supabase Management API.
 *
 * Usage:
 *   node scripts/run-mcp-payloads.js --dir supabase/scripts/import_batches/_mcp_queue/ca_combined
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/run-mcp-payloads.js --dir ...
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
    args.options.dir || 'supabase/scripts/import_batches/_mcp_queue/ca_combined'
  );
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  const parallel = Number(args.options.parallel || 4);

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  if (!token) {
    console.error('Set SUPABASE_ACCESS_TOKEN');
    console.error(`Payloads ready: ${files.length} in ${dir}`);
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
        const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        process.stdout.write(`${file}… `);
        await postSql(token, payload.query);
        console.log('OK');
      })
    );
  }

  await postSql(token, 'ANALYZE public.locations;');
  const after = JSON.parse(
    await postSql(token, 'SELECT count(*)::int AS n FROM public.locations')
  )[0]?.n;
  console.log('After:', after);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
