#!/usr/bin/env node
/**
 * Import combined_01..14.sql via Supabase Management API (same backend as MCP execute_sql).
 * Reads full SQL files with fs; falls back to chunk parts if --chunks is set.
 *
 * Usage:
 *   node scripts/import-ca-combined-mcp.js
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/import-ca-combined-mcp.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;
const FULL_DIR = path.join(__dirname, '../supabase/scripts/import_batches/_ca_combined');

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
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  const files = fs
    .readdirSync(FULL_DIR)
    .filter((f) => /^combined_\d+\.sql$/.test(f))
    .sort();

  if (files.length === 0) {
    console.error(`No combined_*.sql in ${FULL_DIR}`);
    process.exit(1);
  }

  let before = null;
  if (token) {
    try {
      before = JSON.parse(
        await executeSql(token, 'SELECT count(*)::int AS n FROM public.locations;')
      )[0]?.n;
    } catch {
      // ignore
    }
  }

  const results = { before, ok: [], failed: [], token_set: Boolean(token) };

  if (!token) {
    console.log(JSON.stringify({ ...results, files, note: 'No token; emit payloads only' }, null, 2));
    for (const file of files) {
      const sql = fs.readFileSync(path.join(FULL_DIR, file), 'utf8');
      const out = path.join(
        __dirname,
        '../supabase/scripts/import_batches/_mcp_queue/run_args',
        `_invoke_${file.replace('.sql', '')}.json`
      );
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(
        out,
        JSON.stringify({ project_id: PROJECT_ID, query: sql, _file: file })
      );
      console.log(`payload ${file} (${sql.length} bytes) -> ${out}`);
    }
    process.exit(0);
  }

  console.log('Before:', before);
  for (const file of files) {
    const sql = fs.readFileSync(path.join(FULL_DIR, file), 'utf8');
    process.stdout.write(`${file} (${sql.length}b)… `);
    try {
      await executeSql(token, sql);
      results.ok.push(file);
      console.log('OK');
    } catch (error) {
      results.failed.push({ file, error: error.message });
      console.log('FAIL');
      console.error(error.message);
      break;
    }
  }

  if (results.ok.length === files.length) {
    await executeSql(token, 'ANALYZE public.locations;');
    const after = JSON.parse(
      await executeSql(token, 'SELECT count(*)::int AS n FROM public.locations;')
    )[0]?.n;
    results.after = after;
    results.added = after - before;
  }

  console.log('\n' + JSON.stringify(results, null, 2));
  if (results.failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
