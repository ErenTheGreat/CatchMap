#!/usr/bin/env node
/** Print MCP execute_sql args from _call_N.json (single-line JSON for agent). */
const fs = require('fs');
const path = require('path');
const n = Number(process.argv[2]);
if (!n) {
  console.error('Usage: node scripts/mcp-exec-chunk-from-call-json.js <chunk>');
  process.exit(2);
}
const callPath = path.join(__dirname, `../.import/ca_chunks/_call_${n}.json`);
if (!fs.existsSync(callPath)) {
  require('child_process').execFileSync(process.execPath, [
    path.join(__dirname, 'load-mcp-chunk-args.js'),
    String(n),
  ], { stdio: ['ignore', fs.openSync(callPath, 'w'), 'inherit'] });
}
process.stdout.write(fs.readFileSync(callPath, 'utf8'));
