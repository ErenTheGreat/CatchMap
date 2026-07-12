#!/usr/bin/env node
/**
 * Import CA chunks via Supabase MCP HTTP endpoint.
 * Requires MCP auth: set SUPABASE_MCP_ACCESS_TOKEN or run via Cursor CallMcpTool.
 * Fallback: SUPABASE_ACCESS_TOKEN for Management API.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const CHUNK_DIR = path.join(__dirname, '../supabase/scripts/import_batches/_ca_json_chunks');
const OUT_DIR = path.join(__dirname, '../.import/ca_chunks');
const STATUS_PATH = path.join(OUT_DIR, 'import_status.json');
const PARALLEL = 4;
const TOTAL = 42;
const MCP_URL = 'https://mcp.supabase.com/mcp';

function loadStatus() {
  if (!fs.existsSync(STATUS_PATH)) {
    return { baseline: 2778, ok: [], failed: [], startedAt: new Date().toISOString() };
  }
  return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
}

function saveStatus(status) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));
}

function markOk(file) {
  spawnSync(process.execPath, [
    path.join(__dirname, 'run-ca-chunk-wave-mcp.js'),
    '--mark-ok',
    '--file',
    file,
  ], { stdio: 'inherit' });
}

function markFail(file, error) {
  spawnSync(process.execPath, [
    path.join(__dirname, 'run-ca-chunk-wave-mcp.js'),
    '--mark-fail',
    '--file',
    file,
    '--error',
    error.slice(0, 500),
  ], { stdio: 'inherit' });
}

async function executeViaManagementApi(query) {
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN not set');
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  return text;
}

async function executeViaMcpHttp(query) {
  const token = process.env.SUPABASE_MCP_ACCESS_TOKEN;
  if (!token) throw new Error('SUPABASE_MCP_ACCESS_TOKEN not set');

  const initRes = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'ca-chunk-import', version: '1.0.0' },
      },
    }),
  });
  if (!initRes.ok) throw new Error(`MCP init ${initRes.status}`);

  const sessionId = initRes.headers.get('mcp-session-id');
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;

  const callRes = await fetch(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'execute_sql',
        arguments: { project_id: PROJECT_ID, query },
      },
    }),
  });
  const text = await callRes.text();
  if (!callRes.ok) throw new Error(`MCP call ${callRes.status} ${text.slice(0, 300)}`);
  if (text.includes('"isError":true') || text.includes('"error"')) {
    throw new Error(text.slice(0, 500));
  }
  return text;
}

async function executeSql(query) {
  if (process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT) {
    return executeViaManagementApi(query);
  }
  return executeViaMcpHttp(query);
}

async function runChunk(n) {
  const file = `chunk_${String(n).padStart(4, '0')}.sql`;
  const sql = fs.readFileSync(path.join(CHUNK_DIR, file), 'utf8');
  try {
    await executeSql(sql);
    markOk(file);
    return { n, file, ok: true };
  } catch (e) {
    markFail(file, String(e.message || e));
    return { n, file, ok: false, error: String(e.message || e) };
  }
}

async function main() {
  const status = loadStatus();
  const done = new Set(status.ok || []);
  const pending = [];
  for (let n = 1; n <= TOTAL; n++) {
    const file = `chunk_${String(n).padStart(4, '0')}.sql`;
    if (!done.has(file)) pending.push(n);
  }

  const results = [];
  for (let i = 0; i < pending.length; i += PARALLEL) {
    const wave = pending.slice(i, i + PARALLEL);
    const waveResults = await Promise.all(wave.map(runChunk));
    results.push(...waveResults);
    console.log(`Wave ${Math.floor(i / PARALLEL)}:`, waveResults.map((r) => `${r.file}:${r.ok ? 'ok' : 'fail'}`).join(', '));
  }

  await executeSql('ANALYZE public.locations;');
  const total = JSON.parse(await executeSql('SELECT count(*)::int AS total FROM public.locations;'))[0].total;
  const ca = JSON.parse(
    await executeSql(
      'SELECT count(*)::int AS n FROM public.locations WHERE ST_Y(coordinates::geometry) BETWEEN 32.5 AND 42.0 AND ST_X(coordinates::geometry) BETWEEN -124.5 AND -114.0;'
    )
  )[0].n;
  const cats = JSON.parse(
    await executeSql('SELECT category, count(*)::int AS n FROM public.locations GROUP BY 1 ORDER BY 1;')
  );

  console.log(JSON.stringify({ total, ca_bbox: ca, categories: cats, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
