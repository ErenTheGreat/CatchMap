#!/usr/bin/env node
/**
 * Split CA JSON chunk SQL into mini-batches (~15KB) for MCP execute_sql.
 * Usage: node scripts/split-ca-json-chunk-mini.js --all
 */
const fs = require('fs');
const path = require('path');

const CHUNK_DIR = path.join(__dirname, '../supabase/scripts/import_batches/_ca_json_chunks');
const OUT_DIR = path.join(__dirname, '../.import/ca_mini_chunks');
const MAX_BYTES = 15000;

const HEADER =
  'INSERT INTO public.locations (name, category, water_type, coordinates)\n' +
  'SELECT v.name, v.category, v.water_type, v.coordinates\nFROM (\n  VALUES\n';

const FOOTER =
  ') AS v(name, category, water_type, coordinates)\n' +
  'WHERE NOT EXISTS (\n' +
  '  SELECT 1\n' +
  '  FROM public.locations l\n' +
  '  WHERE lower(trim(l.name)) = lower(trim(v.name))\n' +
  '    AND ST_DWithin(\n' +
  '      l.coordinates,\n' +
  '      v.coordinates,\n' +
  '      250\n' +
  '    )\n' +
  ');\n';

function extractRows(sql) {
  const start = sql.indexOf('VALUES');
  const end = sql.indexOf(') AS v(');
  if (start < 0 || end < 0) throw new Error('Unexpected chunk SQL shape');
  const body = sql.slice(start + 'VALUES'.length, end).trim();
  const rows = [];
  let i = 0;
  while (i < body.length) {
    const open = body.indexOf('(', i);
    if (open < 0) break;
    let depth = 0;
    let j = open;
    for (; j < body.length; j++) {
      const ch = body[j];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          rows.push(body.slice(open, j + 1).trim());
          i = j + 1;
          break;
        }
      }
    }
    if (depth !== 0) throw new Error('Unbalanced parens in VALUES');
  }
  return rows;
}

function buildSql(rows) {
  return HEADER + rows.map((r, idx) => (idx === rows.length - 1 ? `  ${r}` : `  ${r},`)).join('\n') + '\n' + FOOTER;
}

function splitChunk(file) {
  const sql = fs.readFileSync(path.join(CHUNK_DIR, file), 'utf8');
  const rows = extractRows(sql);
  const parts = [];
  let batch = [];
  for (const row of rows) {
    const candidate = [...batch, row];
    const candidateSql = buildSql(candidate);
    if (candidateSql.length > MAX_BYTES && batch.length) {
      parts.push(buildSql(batch));
      batch = [row];
    } else {
      batch = candidate;
    }
  }
  if (batch.length) parts.push(buildSql(batch));
  return parts;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const files = fs.readdirSync(CHUNK_DIR).filter((f) => /^chunk_\d+\.sql$/.test(f)).sort();
  const manifest = [];
  for (const file of files) {
    const parts = splitChunk(file);
    parts.forEach((sql, idx) => {
      const key = `${file.replace('.sql', '')}__m${String(idx).padStart(2, '0')}`;
      fs.writeFileSync(path.join(OUT_DIR, `${key}.sql`), sql);
      manifest.push({ key, parent: file, bytes: sql.length });
    });
  }
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify({ mini: manifest, total: manifest.length }, null, 2));
  console.log(`Split ${files.length} chunks -> ${manifest.length} mini parts`);
}

main();
