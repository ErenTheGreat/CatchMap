#!/usr/bin/env node
/**
 * Split CA combined chunk SQL into mini-batches safe for MCP execute_sql (~15KB).
 *
 * Usage:
 *   node scripts/mcp-split-chunk-sql.js --all
 *   node scripts/mcp-split-chunk-sql.js --key combined_01_p0
 *   node scripts/mcp-split-chunk-sql.js --list
 */
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/import-utils');

const CHUNK_DIR = path.join(__dirname, '../supabase/scripts/import_batches/_mcp_queue/ca_combined');
const OUT_DIR = path.join(__dirname, '../.import/mini_chunks');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');
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

function listChunkKeys() {
  return fs
    .readdirSync(CHUNK_DIR)
    .filter((f) => /^combined_\d+_p\d+\.sql$/.test(f))
    .map((f) => f.replace('.sql', ''))
    .sort();
}

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

function splitChunk(key) {
  const sql = fs.readFileSync(path.join(CHUNK_DIR, `${key}.sql`), 'utf8');
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

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const miniKeys = [];
  parts.forEach((partSql, idx) => {
    const miniKey = `${key}__m${String(idx).padStart(2, '0')}`;
    fs.writeFileSync(path.join(OUT_DIR, `${miniKey}.sql`), partSql);
    miniKeys.push({ key: miniKey, parent: key, bytes: partSql.length, rows: extractRows(partSql).length });
  });
  return miniKeys;
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST)) return { mini: [], ok: [], failed: [] };
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
}

function saveManifest(m) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2));
}

function main() {
  const args = parseArgs(process.argv);
  const manifest = loadManifest();

  if (args.flags.has('list')) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  let keys = listChunkKeys();
  if (args.options.key || args.positional?.[0]) {
    keys = [args.options.key || args.positional[0]];
  }

  const allMini = [];
  for (const key of keys) {
    const mini = splitChunk(key);
    allMini.push(...mini);
    console.log(`${key}: ${mini.length} mini parts (${mini.map((m) => m.bytes).join(', ')}b)`);
  }

  if (args.flags.has('all')) {
    manifest.mini = allMini;
    manifest.ok = manifest.ok || [];
    manifest.failed = manifest.failed || [];
    saveManifest(manifest);
    console.log(`manifest: ${allMini.length} mini chunks`);
  }
}

main();
