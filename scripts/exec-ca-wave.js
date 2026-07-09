#!/usr/bin/env node
/** Print MCP execute_sql payloads for a wave (4 chunks). */
const fs = require('fs');
const path = require('path');

const CHUNK_DIR = path.join(__dirname, '../supabase/scripts/import_batches/_ca_json_chunks');
const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const PARALLEL = 4;
const TOTAL = 42;

const wave = Number(process.argv[2] ?? 0);
const start = wave * PARALLEL + 1;
const end = Math.min(start + PARALLEL - 1, TOTAL);

const payloads = [];
for (let i = start; i <= end; i++) {
  const file = `chunk_${String(i).padStart(4, '0')}.sql`;
  const sql = fs.readFileSync(path.join(CHUNK_DIR, file), 'utf8');
  payloads.push({ n: i, file, project_id: PROJECT_ID, query: sql });
}
console.log(JSON.stringify({ wave, start, end, payloads }));
