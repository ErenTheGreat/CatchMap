#!/usr/bin/env node
/** Print SQL for chunk N (1-42) to stdout for MCP execute_sql. */
const fs = require('fs');
const path = require('path');

const n = Number(process.argv[2]);
const file = `chunk_${String(n).padStart(4, '0')}.sql`;
const dir = path.join(__dirname, '../supabase/scripts/import_batches/_ca_json_chunks');
process.stdout.write(fs.readFileSync(path.join(dir, file), 'utf8'));
