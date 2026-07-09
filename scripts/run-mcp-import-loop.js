#!/usr/bin/env node
/**
 * Execute SQL files by emitting MCP execute_sql payloads to stdout (one JSON per line).
 * Used with: node scripts/run-mcp-import-loop.js --dir ... | while read payload; do ...
 *
 * For agent-driven imports via Supabase MCP plugin (project_id + query).
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
    args.options.dir || 'supabase/scripts/import_batches/_ca_combined'
  );
  const start = Number(args.options.start || 1);
  const limit = args.options.limit ? Number(args.options.limit) : null;

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const slice = limit ? files.slice(start - 1, start - 1 + limit) : files.slice(start - 1);

  for (const file of slice) {
    const query = fs.readFileSync(path.join(dir, file), 'utf8');
    const payload = { project_id: PROJECT_ID, query, _file: file };
    process.stdout.write(JSON.stringify(payload) + '\n');
  }
}

main();
