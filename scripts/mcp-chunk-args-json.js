#!/usr/bin/env node
/**
 * Load chunk N args and print {project_id, query} for MCP execute_sql.
 * Agent reads stdout JSON and calls CallMcpTool.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const n = Number(process.argv[2]);
if (!n || n < 1 || n > 42) {
  console.error('Usage: node scripts/mcp-chunk-args-json.js <1-42>');
  process.exit(2);
}

const callPath = path.join(__dirname, `../.import/ca_chunks/_call_${n}.json`);
if (!fs.existsSync(callPath)) {
  execFileSync(process.execPath, [path.join(__dirname, 'load-mcp-chunk-args.js'), String(n)], {
    stdio: ['ignore', fs.openSync(callPath, 'w'), 'inherit'],
  });
}
process.stdout.write(fs.readFileSync(callPath, 'utf8'));
