#!/usr/bin/env node
/**
 * Reads chunk SQL files and outputs manifest for MCP import.
 * Usage: node _run_import.js [--wave N] [--size-only]
 */
const fs = require('fs');
const path = require('path');

const CHUNKS_DIR = path.join(__dirname, '_chunks');
const files = fs.readdirSync(CHUNKS_DIR)
  .filter(f => f.endsWith('.sql'))
  .sort();

const WAVE_SIZE = 4;

if (process.argv.includes('--size-only')) {
  for (const f of files) {
    const p = path.join(CHUNKS_DIR, f);
    console.log(`${fs.statSync(p).size}\t${f}`);
  }
  console.log(`TOTAL: ${files.length} files`);
  process.exit(0);
}

const waveArg = process.argv.indexOf('--wave');
const waveNum = waveArg >= 0 ? parseInt(process.argv[waveArg + 1], 10) : null;

if (waveNum !== null) {
  const start = (waveNum - 1) * WAVE_SIZE;
  const batch = files.slice(start, start + WAVE_SIZE);
  const result = batch.map(f => ({
    file: f,
    sql: fs.readFileSync(path.join(CHUNKS_DIR, f), 'utf8'),
    bytes: fs.statSync(path.join(CHUNKS_DIR, f)).size,
  }));
  console.log(JSON.stringify({ wave: waveNum, start, count: result.length, total: files.length, chunks: result }));
} else {
  const totalWaves = Math.ceil(files.length / WAVE_SIZE);
  console.log(JSON.stringify({ totalFiles: files.length, totalWaves, waveSize: WAVE_SIZE, files }));
}
