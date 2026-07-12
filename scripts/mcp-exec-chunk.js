#!/usr/bin/env node
/**
 * Execute one CA chunk via MCP execute_sql by reading invoke_NNNN.json.
 * Used by parent agent: node scripts/mcp-exec-chunk.js N
 * Prints JSON result {ok, file, error?}
 */
const fs = require('fs');
const path = require('path');

const n = Number(process.argv[2]);
if (!n || n < 1 || n > 42) {
  console.error('Usage: node scripts/mcp-exec-chunk.js <1-42>');
  process.exit(2);
}

const invokePath = path.join(__dirname, `../.import/ca_chunks/invoke_${String(n).padStart(4, '0')}.json`);
if (!fs.existsSync(invokePath)) {
  // regenerate
  require('child_process').execSync(`node ${path.join(__dirname, 'run-ca-chunk-wave-mcp.js')} --chunk ${n}`, {
    stdio: 'inherit',
  });
}

const payload = JSON.parse(fs.readFileSync(invokePath, 'utf8'));
// Output payload path + metadata for MCP caller
console.log(
  JSON.stringify({
    project_id: payload.project_id,
    file: payload.file,
    bytes: payload.query.length,
    invokePath,
    // query written separately to avoid huge stdout in some shells
    queryPath: path.join(__dirname, `../.import/ca_chunks/_q_${String(n).padStart(4, '0')}.sql`),
  })
);
fs.writeFileSync(
  path.join(__dirname, `../.import/ca_chunks/_q_${String(n).padStart(4, '0')}.sql`),
  payload.query
);
