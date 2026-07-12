#!/usr/bin/env node
/**
 * Generate MCP execute_sql payload JSON files for SQL chunks in a directory.
 *
 * Usage:
 *   node scripts/generate-mcp-payloads.js --dir supabase/scripts/import_batches/_ca_json_chunks --out supabase/scripts/import_batches/_mcp_queue/ca_chunks
 */

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/import-utils');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';

function main() {
  const args = parseArgs(process.argv);
  const projectRoot = path.join(__dirname, '..');
  const dir = path.resolve(projectRoot, args.options.dir);
  const outDir = path.resolve(
    projectRoot,
    args.options.out || 'supabase/scripts/import_batches/_mcp_queue/generated'
  );

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  fs.mkdirSync(outDir, { recursive: true });

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const payload = {
      project_id: PROJECT_ID,
      query: sql,
    };
    const outName = file.replace('.sql', '.json');
    fs.writeFileSync(path.join(outDir, outName), JSON.stringify(payload));
  }

  console.log(`Wrote ${files.length} payloads -> ${outDir}`);
}

main();
