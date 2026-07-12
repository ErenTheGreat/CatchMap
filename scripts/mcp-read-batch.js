#!/usr/bin/env node
/** Print next N pending mini-chunk keys as JSON lines with SQL length. */
const fs = require('fs');
const path = require('path');

const MINI_DIR = path.join(__dirname, '../.import/mini_chunks');
const MANIFEST = path.join(MINI_DIR, 'manifest.json');
const STATUS = path.join(__dirname, '../.import/ca_mini_status.json');

const n = Number(process.argv[2] || 8);
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const status = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
const all = manifest.mini.map((m) => m.key).sort();
const pending = all.filter((k) => !status.ok.includes(k)).slice(0, n);

for (const key of pending) {
  const sql = fs.readFileSync(path.join(MINI_DIR, `${key}.sql`), 'utf8');
  console.log(JSON.stringify({ key, bytes: sql.length, sql }));
}
