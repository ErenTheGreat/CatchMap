#!/usr/bin/env node
/**
 * Import SQL chunk files via Supabase MCP execute_sql.
 * Reads SQL from disk and calls the Supabase Management API when token is available,
 * otherwise prints MCP payload paths for agent-driven import.
 *
 * Usage:
 *   node scripts/mcp-import-chunks.js --dir supabase/scripts/import_batches/_ca_json_chunks
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/mcp-import-chunks.js
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
  const progressFile = path.join(dir, '_mcp_import_progress.json');

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let progress = { done: [], errors: [] };
  if (fs.existsSync(progressFile)) {
    progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
  }
  const doneSet = new Set(progress.done);
  const pending = files.filter((f) => !doneSet.has(f));

  if (!token) {
    console.error(`No SUPABASE_ACCESS_TOKEN. ${pending.length} chunks pending in ${dir}`);
    console.error('Use Supabase MCP execute_sql with payloads in _mcp_exec/');
    process.exit(1);
  }

  let before = JSON.parse(await postSql(token, 'SELECT count(*)::int AS n FROM public.locations'))[0]?.n;
  console.log('Before:', before);

  for (let i = 0; i < pending.length; i += parallel) {
    const wave = pending.slice(i, i + parallel);
    await Promise.all(
      wave.map(async (file) => {
        const sql = fs.readFileSync(path.join(dir, file), 'utf8');
        process.stdout.write(`${file}… `);
        try {
          await postSql(token, sql);
          progress.done.push(file);
          console.log('OK');
        } catch (error) {
          progress.errors.push({ file, error: error.message });
          console.log('FAIL', error.message);
        }
      })
    );
    fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2) + '\n');
  }

  await postSql(token, 'ANALYZE public.locations;');
  const after = JSON.parse(await postSql(token, 'SELECT count(*)::int AS n FROM public.locations'))[0]?.n;
  console.log('After:', after, `(+${after - before})`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
