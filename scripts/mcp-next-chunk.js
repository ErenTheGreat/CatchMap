#!/usr/bin/env node
/** Emit next pending CA chunk key + SQL path for MCP execute_sql. */
const fs = require('fs');
const path = require('path');

const CHUNK_DIR = path.join(__dirname, '../supabase/scripts/import_batches/_mcp_queue/ca_combined');
const STATUS_PATH = path.join(__dirname, '../.import/ca_chunk_status.json');

function listChunks() {
  return fs
    .readdirSync(CHUNK_DIR)
    .filter((f) => /^combined_\d+_p\d+\.sql$/.test(f))
    .sort()
    .map((f) => f.replace('.sql', ''));
}

function loadStatus() {
  if (!fs.existsSync(STATUS_PATH)) return { ok: [], failed: [] };
  return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
}

function saveStatus(s) {
  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
  fs.writeFileSync(STATUS_PATH, JSON.stringify(s, null, 2));
}

const args = process.argv.slice(2);
const status = loadStatus();
const chunks = listChunks();

if (args.includes('--list')) {
  console.log(JSON.stringify(chunks));
  process.exit(0);
}

if (args.includes('--mark-ok')) {
  const key = args[args.indexOf('--mark-ok') + 1];
  if (!status.ok.includes(key)) status.ok.push(key);
  saveStatus(status);
  console.log('ok', key);
  process.exit(0);
}

if (args.includes('--mark-fail')) {
  const key = args[args.indexOf('--mark-fail') + 1];
  const err = args[args.indexOf('--mark-fail') + 2] || 'unknown';
  status.failed.push({ key, error: err });
  saveStatus(status);
  console.log('fail', key, err);
  process.exit(0);
}

if (args.includes('--status')) {
  console.log(JSON.stringify({ total: chunks.length, ...status }, null, 2));
  process.exit(0);
}

const key = args[0];
if (key) {
  const sqlPath = path.join(CHUNK_DIR, `${key}.sql`);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const out = path.join(__dirname, '../.import/mcp_query.sql');
  fs.writeFileSync(out, sql);
  console.log(JSON.stringify({ project_id: 'cpzwvlpqdzjjsdlnmfgg', key, bytes: sql.length, sql_path: out }));
  process.exit(0);
}

const pending = chunks.find((k) => !status.ok.includes(k) && !status.failed.some((f) => f.key === k));
if (!pending) {
  console.log(JSON.stringify({ done: true, total: chunks.length, ok: status.ok.length }));
  process.exit(0);
}

const sqlPath = path.join(CHUNK_DIR, `${pending}.sql`);
const sql = fs.readFileSync(sqlPath, 'utf8');
const out = path.join(__dirname, '../.import/mcp_query.sql');
fs.writeFileSync(out, sql);
console.log(JSON.stringify({ project_id: 'cpzwvlpqdzjjsdlnmfgg', key: pending, bytes: sql.length, sql_path: out }));
