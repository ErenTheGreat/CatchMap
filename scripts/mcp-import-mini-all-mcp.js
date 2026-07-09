#!/usr/bin/env node
/**
 * Import all pending CA mini-chunks via Supabase MCP HTTP (parallel waves).
 * Auth: SUPABASE_MCP_ACCESS_TOKEN, SUPABASE_ACCESS_TOKEN, or Management API PAT.
 *
 * Usage: node scripts/mcp-import-mini-all-mcp.js [--parallel 8]
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const MINI_DIR = path.join(__dirname, '../.import/mini_chunks');
const MANIFEST = path.join(MINI_DIR, 'manifest.json');
const STATUS = path.join(__dirname, '../.import/ca_mini_status.json');
const RUNNER = path.join(__dirname, 'mcp-mini-chunk-runner.js');
const MCP_URL = 'https://mcp.supabase.com/mcp';

function pendingKeys() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const status = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
  const ok = new Set(status.ok || []);
  return manifest.mini.map((m) => m.key).sort().filter((k) => !ok.has(k));
}

function markOk(key) {
  spawnSync(process.execPath, [RUNNER, '--mark-ok', '--key', key], { stdio: 'pipe' });
}

async function postManagementApi(token, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 400)}`);
  return text;
}

async function mcpHttpSession(token) {
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
        clientInfo: { name: 'ca-mini-import', version: '1.0.0' },
      },
    }),
  });
  if (!initRes.ok) throw new Error(`MCP init ${initRes.status}: ${await initRes.text()}`);
  const sessionId = initRes.headers.get('mcp-session-id');
  return { token, sessionId };
}

async function mcpExecuteSql(session, query) {
  const headers = {
    Authorization: `Bearer ${session.token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (session.sessionId) headers['mcp-session-id'] = session.sessionId;

  const callRes = await fetch(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: 'execute_sql',
        arguments: { project_id: PROJECT_ID, query },
      },
    }),
  });
  const text = await callRes.text();
  if (!callRes.ok) throw new Error(`MCP ${callRes.status}: ${text.slice(0, 400)}`);
  if (/\"isError\":\s*true/.test(text)) throw new Error(text.slice(0, 500));
  return text;
}

async function main() {
  const parIdx = process.argv.indexOf('--parallel');
  const parallel = parIdx >= 0 ? Math.max(1, Number(process.argv[parIdx + 1]) || 8) : 8;

  const mgmtToken = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  const mcpToken = process.env.SUPABASE_MCP_ACCESS_TOKEN;

  if (!mgmtToken && !mcpToken) {
    console.error('No token — use CallMcpTool execute_sql loop instead');
    process.exit(1);
  }

  const pending = pendingKeys();
  console.log(JSON.stringify({ pending: pending.length, parallel }));

  let executeSql;
  let session = null;

  if (mgmtToken) {
    executeSql = (q) => postManagementApi(mgmtToken, q);
  } else {
    session = await mcpHttpSession(mcpToken);
    executeSql = (q) => mcpExecuteSql(session, q);
  }

  const before = JSON.parse(await executeSql('SELECT count(*)::int AS n FROM public.locations;'))[0]?.n;
  console.log('Before:', before);

  const failed = [];
  for (let i = 0; i < pending.length; i += parallel) {
    const wave = pending.slice(i, i + parallel);
    const results = await Promise.all(
      wave.map(async (key) => {
        const sql = fs.readFileSync(path.join(MINI_DIR, `${key}.sql`), 'utf8');
        try {
          await executeSql(sql);
          markOk(key);
          return { key, ok: true };
        } catch (e) {
          failed.push({ key, error: String(e.message || e).slice(0, 500) });
          return { key, ok: false, error: String(e.message || e).slice(0, 200) };
        }
      })
    );
    console.log(`Wave ${Math.floor(i / parallel)}:`, results.map((r) => `${r.key}:${r.ok ? 'ok' : 'fail'}`).join(', '));
    if (failed.length) break;
  }

  if (failed.length) {
    console.log(JSON.stringify({ before, failed }, null, 2));
    process.exit(1);
  }

  await executeSql('ANALYZE public.locations;');
  const after = JSON.parse(await executeSql('SELECT count(*)::int AS n FROM public.locations;'))[0]?.n;
  const caBbox = JSON.parse(
    await executeSql(
      `SELECT count(*)::int AS n FROM public.locations
       WHERE ST_Y(coordinates::geometry) BETWEEN 32.5 AND 42.0
         AND ST_X(coordinates::geometry) BETWEEN -124.5 AND -114.0;`
    )
  )[0]?.n;
  const categories = JSON.parse(
    await executeSql('SELECT category, count(*)::int AS n FROM public.locations GROUP BY 1 ORDER BY 1;')
  );

  spawnSync(process.execPath, [RUNNER, '--parents-done'], { stdio: 'inherit' });

  console.log(
    JSON.stringify(
      { before, after, added: after - before, ca_bbox: caBbox, categories, ok: pending.length, failed: 0 },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
