#!/usr/bin/env node
/** Test Supabase MCP HTTP execute_sql for one key. Usage: node scripts/mcp-test-http-one.js KEY */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const MCP_URL = 'https://mcp.supabase.com/mcp';
const key = process.argv[2] || 'combined_02_p0__m04';
const sql = fs.readFileSync(path.join(__dirname, '../.import/mini_chunks', `${key}.sql`), 'utf8');

async function main() {
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
        clientInfo: { name: 'ca-mini-test', version: '1.0.0' },
      },
    }),
  });
  console.log('init', initRes.status);
  const initText = await initRes.text();
  if (!initRes.ok) {
    console.log(initText.slice(0, 300));
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
  console.log('call', callRes.status);
  console.log((await callRes.text()).slice(0, 500));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
