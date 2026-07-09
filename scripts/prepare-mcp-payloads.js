#!/usr/bin/env node
/**
 * Prepare MCP execute_sql payloads from SQL chunk files.
 * Usage: node scripts/prepare-mcp-payloads.js --dir supabase/scripts/import_batches/_ca_json_chunks --out supabase/scripts/import_batches/_mcp_exec
 */

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/import-utils');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';

function main() {
  const args = parseArgs(process.argv);
  const projectRoot = path.join(__dirname, '..');
  const dir = path.resolve(
    projectRoot,
    args.options.dir || 'supabase/scripts/import_batches/_ca_json_chunks'
  );
  const outDir = path.resolve(
    projectRoot,
    args.options.out || 'supabase/scripts/import_batches/_mcp_exec'
  );

  fs.mkdirSync(outDir, { recursive: true });

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const query = fs.readFileSync(path.join(dir, file), 'utf8');
    const base = file.replace(/\.sql$/, '');
    const payload = { project_id: PROJECT_ID, query };
    fs.writeFileSync(path.join(outDir, `${base}.json`), JSON.stringify(payload));
    console.log(`${base}.json (${query.length} bytes)`);
  }

  console.log(`\nPrepared ${files.length} payloads in ${outDir}`);
}

main();
