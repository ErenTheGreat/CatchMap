#!/usr/bin/env node
/** Read a wave of Great Lakes chunk SQL files (4 per wave). Usage: node read_wave.js <waveIndex> */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '_chunks');
const wave = parseInt(process.argv[2] ?? process.argv[1] ?? '0', 10);

const files = fs
  .readdirSync(dir)
  .filter((f) => /^batch_\d+_chunk_\d+\.sql$/.test(f))
  .sort((a, b) => {
    const pa = a.match(/batch_(\d+)_chunk_(\d+)/);
    const pb = b.match(/batch_(\d+)_chunk_(\d+)/);
    return +pa[1] - +pb[1] || +pa[2] - +pb[2];
  });

const start = wave * 4;
const batch = files.slice(start, start + 4).map((f) => ({
  name: f,
  sql: fs.readFileSync(path.join(dir, f), 'utf8'),
}));

if (batch.length === 0) {
  process.exit(2);
}

process.stdout.write(JSON.stringify(batch));
