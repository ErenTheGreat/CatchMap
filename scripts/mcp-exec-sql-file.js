#!/usr/bin/env node
/**
 * Execute one SQL file via Supabase MCP HTTP endpoint.
 * Usage: node scripts/mcp-exec-sql-file.js path/to/file.sql
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const MCP_URL = 'https://mcp.supabase.com/mcp';

async function main() {
  const sqlPath = process.argv[2];
  if (!sqlPath) {
    console.error('Usage: node scripts/mcp-exec-sql-file.js <file.sql>');
    process.exit(2);
  }
  const sql = fs.readFileSync(path.resolve(sqlPath), 'utf8');
  const label = path.basename(sqlPath);

  const token =
    process.env.SUPABASE_MCP_ACCESS_TOKEN ||
    process.env.SUPABASE_ACCESS_TOKEN ||
    process.env.SUPABASE_PAT;

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const initRes = await fetch(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'mcp-exec-sql-file', version: '1.0.0' },
      },
    }),
  });
  if (!initRes.ok) {
    console.error('init failed', initRes.status, (await initRes.text()).slice(0, 300));
    process.exit(1);
  }

  const sessionId = initRes.headers.get('mcp-session-id');
  const callHeaders = { ...headers };
  if (sessionId) callHeaders['mcp-session-id'] = sessionId;

  const callRes = await fetch(MCP_URL, {
    method: 'POST',
    headers: callHeaders,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'execute_sql',
        arguments: { project_id: PROJECT_ID, query: sql },
      },
    }),
  });
  const text = await callRes.text();
  console.log(label, callRes.status, text.slice(0, 400));
  process.exit(callRes.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
