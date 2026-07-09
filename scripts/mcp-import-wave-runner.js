#!/usr/bin/env node
/**
 * Import all 42 CA chunks by reading SQL from disk and calling MCP execute_sql
 * through prepared payload files. Marks status after each chunk.
 *
 * This script is invoked by the agent loop:
 *   node scripts/mcp-import-wave-runner.js --wave 0
 *
 * It prints MCP call instructions; the agent must CallMcpTool execute_sql per chunk.
 * When CURSOR_MCP_BRIDGE=1 and running inside Cursor agent, use --self-test only.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const CHUNK_DIR = path.join(__dirname, '../supabase/scripts/import_batches/_ca_json_chunks');
const OUT_DIR = path.join(__dirname, '../.import/ca_chunks');
const PARALLEL = 4;
const TOTAL = 42;

function chunkFile(n) {
  return `chunk_${String(n).padStart(4, '0')}.sql`;
}

function readSql(n) {
  return fs.readFileSync(path.join(CHUNK_DIR, chunkFile(n)), 'utf8');
}

function markOk(file) {
  spawnSync(process.execPath, [
    path.join(__dirname, 'run-ca-chunk-wave-mcp.js'),
    '--mark-ok',
    '--file',
    file,
  ]);
}

function markFail(file, error) {
  spawnSync(process.execPath, [
    path.join(__dirname, 'run-ca-chunk-wave-mcp.js'),
    '--mark-fail',
    '--file',
    file,
    '--error',
    String(error).slice(0, 500),
  ]);
}

function waveRange(wave) {
  const start = wave * PARALLEL + 1;
  const end = Math.min(start + PARALLEL - 1, TOTAL);
  const nums = [];
  for (let n = start; n <= end; n++) nums.push(n);
  return nums;
}

async function postManagementApi(token, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 400)}`);
  return text;
}

async function runChunkDirect(n) {
  const file = chunkFile(n);
  const sql = readSql(n);
  await postManagementApi(process.env.SUPABASE_ACCESS_TOKEN, sql);
  markOk(file);
  return { n, file, ok: true };
}

async function main() {
  const waveIdx = process.argv.indexOf('--wave');
  const all = process.argv.includes('--all');
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;

  if (waveIdx >= 0 || all) {
    if (!token) {
      const wave = waveIdx >= 0 ? Number(process.argv[waveIdx + 1]) : null;
      const chunks = all
        ? Array.from({ length: TOTAL }, (_, i) => i + 1)
        : waveRange(wave);
      for (const n of chunks) {
        const sql = readSql(n);
        const payload = { project_id: PROJECT_ID, query: sql, file: chunkFile(n), n };
        fs.writeFileSync(path.join(OUT_DIR, `_pending_mcp_${n}.json`), JSON.stringify(payload));
      }
      console.log(
        JSON.stringify({
          mode: 'mcp_manual',
          chunks: all ? '1-42' : chunks,
          note: 'Call CallMcpTool execute_sql per _pending_mcp_N.json or use --all with SUPABASE_ACCESS_TOKEN',
        })
      );
      process.exit(0);
    }

    const pending = all
      ? Array.from({ length: TOTAL }, (_, i) => i + 1)
      : waveRange(Number(process.argv[waveIdx + 1]));

    const results = [];
    for (let i = 0; i < pending.length; i += PARALLEL) {
      const wave = pending.slice(i, i + PARALLEL);
      const waveResults = await Promise.all(
        wave.map((n) =>
          runChunkDirect(n).catch((e) => {
            markFail(chunkFile(n), e.message);
            return { n, file: chunkFile(n), ok: false, error: e.message };
          })
        )
      );
      results.push(...waveResults);
      console.log(waveResults.map((r) => `${r.file}:${r.ok ? 'ok' : 'fail'}`).join(', '));
    }

    if (all) {
      await postManagementApi(token, 'ANALYZE public.locations;');
      const total = JSON.parse(await postManagementApi(token, 'SELECT count(*)::int AS total FROM public.locations;'))[0]
        .total;
      const ca = JSON.parse(
        await postManagementApi(
          token,
          'SELECT count(*)::int AS n FROM public.locations WHERE ST_Y(coordinates::geometry) BETWEEN 32.5 AND 42.0 AND ST_X(coordinates::geometry) BETWEEN -124.5 AND -114.0;'
        )
      )[0].n;
      const cats = JSON.parse(
        await postManagementApi(token, 'SELECT category, count(*)::int AS n FROM public.locations GROUP BY 1 ORDER BY 1;')
      );
      console.log(JSON.stringify({ total, ca_bbox: ca, categories: cats, results }, null, 2));
    } else {
      console.log(JSON.stringify({ results }, null, 2));
    }
    return;
  }

  console.error('Usage: --wave N | --all');
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
