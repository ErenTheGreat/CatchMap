#!/usr/bin/env node
/**
 * Prepare all 42 CA chunk payloads for MCP execute_sql (readFileSync).
 * Writes per-chunk JSON + batch manifest for agent MCP calls.
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const CHUNK_DIR = path.join(
  __dirname,
  '../supabase/scripts/import_batches/_ca_json_chunks'
);
const OUT = path.join(__dirname, '../.import/ca_chunks');
const PARALLEL = 4;

fs.mkdirSync(OUT, { recursive: true });

const files = fs
  .readdirSync(CHUNK_DIR)
  .filter((f) => /^chunk_\d{4}\.sql$/.test(f))
  .sort();

const manifest = { project_id: PROJECT_ID, total: files.length, waves: [] };

for (let w = 0; w * PARALLEL < files.length; w++) {
  const slice = files.slice(w * PARALLEL, w * PARALLEL + PARALLEL);
  const wave = { wave: w, files: [] };
  for (const file of slice) {
    const query = fs.readFileSync(path.join(CHUNK_DIR, file), 'utf8');
    const base = file.replace('.sql', '');
    const payload = { project_id: PROJECT_ID, file, query, bytes: query.length };
    const outPath = path.join(OUT, `${base}.payload.json`);
    fs.writeFileSync(outPath, JSON.stringify(payload));
    wave.files.push({ file, bytes: query.length, payload: outPath });
  }
  manifest.waves.push(wave);
}

const statusPath = path.join(OUT, 'import_status.json');
if (!fs.existsSync(statusPath)) {
  fs.writeFileSync(
    statusPath,
    JSON.stringify({ before: 2778, ok: [], failed: [], startedAt: new Date().toISOString() }, null, 2)
  );
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ chunks: files.length, waves: manifest.waves.length, out: OUT }));
