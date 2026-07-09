#!/usr/bin/env node
/**
 * Import all 96 Great Lakes chunk SQL files.
 * Reads each chunk from _chunks/ via fs.readFileSync.
 *
 * Execution backends (first available wins):
 * 1. Direct Postgres (SUPABASE_DB_PASSWORD in .env or env)
 * 2. Supabase Management API (SUPABASE_ACCESS_TOKEN)
 * 3. Supabase MCP stdio (@supabase/mcp-server-supabase + token)
 *
 * Usage:
 *   node run_great_lakes_import.js
 *   node run_great_lakes_import.js --wave 0   # single wave (4 chunks)
 */
const fs = require('fs');
const path = require('path');
const { loadEnv, connectPg } = require('../../../../scripts/lib/import-utils');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const CHUNK_DIR = path.join(__dirname, '_chunks');
const PARALLEL = 4;
const RESULT_FILE = path.join(__dirname, '_great_lakes_import_result.json');
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;

const COUNT_SQL = `SELECT COUNT(*) AS total_locations,
  COUNT(*) FILTER (WHERE ST_Intersects(coordinates, ST_MakeEnvelope(-92.5, 41.0, -76.0, 49.5, 4326)::geography)) AS great_lakes_count
  FROM public.locations;`;

function listChunks() {
  return fs
    .readdirSync(CHUNK_DIR)
    .filter((f) => /^batch_\d+_chunk_\d+\.sql$/.test(f))
    .sort((a, b) => {
      const pa = a.match(/batch_(\d+)_chunk_(\d+)/);
      const pb = b.match(/batch_(\d+)_chunk_(\d+)/);
      return +pa[1] - +pb[1] || +pa[2] - +pb[2];
    });
}

function readChunk(name) {
  return fs.readFileSync(path.join(CHUNK_DIR, name), 'utf8');
}

async function postSql(token, query) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

async function runMcpStdio(token) {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['--yes', '@supabase/mcp-server-supabase', `--access-token=${token}`, `--project-ref=${PROJECT_ID}`],
  });
  const client = new Client({ name: 'great-lakes-import', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);

  return {
    async executeSql(query) {
      const result = await client.callTool({ name: 'execute_sql', arguments: { project_id: PROJECT_ID, query } });
      if (result.isError) throw new Error(JSON.stringify(result.content));
      const text = result.content?.map((c) => c.text).join('') || '';
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    },
    close: () => client.close(),
  };
}

async function pickBackend() {
  const projectRoot = path.join(__dirname, '../../../../');
  const { password } = loadEnv(projectRoot);
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;

  if (password) {
    const client = await connectPg(PROJECT_ID, password);
    return {
      name: 'postgres',
      async count() {
        const r = await client.query(COUNT_SQL);
        return r.rows[0];
      },
      async exec(sql) {
        await client.query(sql);
      },
      async close() {
        await client.end();
      },
    };
  }

  if (token) {
    // Prefer Management API (same backend as MCP execute_sql)
    return {
      name: 'management_api',
      async count() {
        const rows = await postSql(token, COUNT_SQL);
        return rows[0];
      },
      async exec(sql) {
        await postSql(token, sql);
      },
      async close() {},
    };
  }

  return null;
}

async function main() {
  const waveOnly = process.argv.includes('--wave')
    ? Number(process.argv[process.argv.indexOf('--wave') + 1])
    : null;

  const backend = await pickBackend();
  if (!backend) {
    console.error('No credentials. Set SUPABASE_DB_PASSWORD in .env or SUPABASE_ACCESS_TOKEN.');
    console.error('Alternatively, use Cursor Supabase MCP execute_sql with payloads in _mcp_exec/payloads/');
    process.exit(1);
  }

  const chunks = listChunks();
  const slice =
    waveOnly != null && !Number.isNaN(waveOnly)
      ? chunks.slice(waveOnly * PARALLEL, waveOnly * PARALLEL + PARALLEL)
      : chunks;

  console.log(`Backend: ${backend.name}, chunks: ${slice.length}/${chunks.length}`);

  const before = await backend.count();
  console.log(`BEFORE: total=${before.total_locations}, great_lakes=${before.great_lakes_count}`);

  const completed = [];
  const errors = [];

  for (let i = 0; i < slice.length; i += PARALLEL) {
    const wave = slice.slice(i, i + PARALLEL);
    const waveNum = Math.floor(i / PARALLEL) + 1 + (waveOnly != null ? waveOnly : 0);
    console.log(`\nWave ${waveNum}: ${wave.join(', ')}`);

    await Promise.all(
      wave.map(async (name) => {
        const sql = readChunk(name);
        process.stdout.write(`  RUN ${name} (${sql.length}b)... `);
        try {
          await backend.exec(sql);
          completed.push(name);
          console.log('OK');
        } catch (err) {
          errors.push({ name, error: String(err.message || err) });
          console.log('FAIL');
        }
      })
    );
  }

  if (waveOnly == null) {
    console.log('\nANALYZE public.locations;');
    await backend.exec('ANALYZE public.locations;');
  }

  const after = await backend.count();
  console.log(`AFTER: total=${after.total_locations}, great_lakes=${after.great_lakes_count}`);

  const summary = {
    backend: backend.name,
    project_id: PROJECT_ID,
    chunks_total: slice.length,
    chunks_ok: completed.length,
    chunks_failed: errors.length,
    before,
    after,
    added_total: Number(after.total_locations) - Number(before.total_locations),
    added_great_lakes: Number(after.great_lakes_count) - Number(before.great_lakes_count),
    completed,
    errors,
  };

  fs.writeFileSync(RESULT_FILE, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  await backend.close();
  if (errors.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
