#!/usr/bin/env node
/** Print {project_id, query} JSON for chunk N (for MCP execute_sql). */
const fs = require('fs');
const path = require('path');

const n = Number(process.argv[2]);
if (!n || n < 1 || n > 42) {
  console.error('Usage: node scripts/print-chunk-mcp-args.js <1-42>');
  process.exit(2);
}

const invokePath = path.join(__dirname, `../.import/ca_chunks/_invoke_${n}.json`);
if (fs.existsSync(invokePath)) {
  const j = JSON.parse(fs.readFileSync(invokePath, 'utf8'));
  process.stdout.write(JSON.stringify({ project_id: j.project_id, query: j.query }));
  process.exit(0);
}

const out = require('child_process').execFileSync(process.execPath, [
  path.join(__dirname, 'load-mcp-chunk-args.js'),
  String(n),
], { encoding: 'utf8' });
process.stdout.write(out);
