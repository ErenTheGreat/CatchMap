#!/usr/bin/env node
/**
 * Import all SQL files in a directory via Supabase MCP execute_sql.
 * Designed for agent use: prints one wave at a time as JSON.
 *
 * Usage:
 *   node scripts/mcp-import-wave.js --dir .import/mcp_run/gulf_coast --wave 0 --parallel 3
 */
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/import-utils');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';

function main() {
  const args = parseArgs(process.argv);
  const projectRoot = path.join(__dirname, '..');
  const dir = path.resolve(projectRoot, args.options.dir || '.');
  const parallel = Number(args.options.parallel || 3);
  const wave = Number(args.options.wave || 0);
  const pattern = args.options.pattern || 'batch_*.sql';

  const re = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
  const files = fs.readdirSync(dir).filter((f) => re.test(f)).sort();
  const start = wave * parallel;
  const slice = files.slice(start, start + parallel);

  if (slice.length === 0) {
    console.log(JSON.stringify({ done: true, totalFiles: files.length }));
    return;
  }

  const payloads = slice.map((file) => ({
    project_id: PROJECT_ID,
    file,
    query: fs.readFileSync(path.join(dir, file), 'utf8'),
  }));

  console.log(JSON.stringify({
    done: false,
    wave,
    totalFiles: files.length,
    files: slice,
    payloads,
  }));
}

main();
