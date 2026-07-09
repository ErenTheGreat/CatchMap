#!/usr/bin/env node
/**
 * Emit MCP execute_sql args for a wave of CA chunk files (1-42).
 * Usage: node scripts/emit-ca-chunk-wave.js 0   # wave 0 = chunks 1-4
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const CHUNK_DIR = path.join(__dirname, '../supabase/scripts/import_batches/_ca_json_chunks');
const PARALLEL = 4;
const TOTAL = 42;

const wave = Number(process.argv[2] || 0);
const start = wave * PARALLEL + 1;
const end = Math.min(start + PARALLEL - 1, TOTAL);

const out = [];
for (let n = start; n <= end; n++) {
  const file = `chunk_${String(n).padStart(4, '0')}.sql`;
  const query = fs.readFileSync(path.join(CHUNK_DIR, file), 'utf8');
  out.push({ file, project_id: PROJECT_ID, query, bytes: query.length });
}

process.stdout.write(JSON.stringify(out, null, 2));
