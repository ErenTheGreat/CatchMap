#!/usr/bin/env node
/**
 * Import Gulf Coast SQL batches via Supabase MCP execute_sql (HTTP).
 * Waves of 3, exponential backoff on 429.
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const MCP_URL = 'https://mcp.supabase.com/mcp';
const BATCH_DIR = path.join(__dirname, '../supabase/scripts/import_batches/gulf_coast');
const PARALLEL = 3;
const COUNT_SQL =
  "SELECT count(*)::int AS total, count(*) FILTER (WHERE ST_Intersects(coordinates, ST_MakeEnvelope(-97.5, 24, -80, 35, 4326)::geography)) AS gulf_coast FROM public.locations;";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function listBatches() {
  return fs
    .readdirSync(BATCH_DIR)
    .filter((f) => /^batch_\d{3}\.sql$/.test(f))
    .sort();
}

async function mcpCall(method, params, sessionId, headers) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: { ...headers, ...(sessionId ? { 'mcp-session-id': sessionId } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`MCP parse error ${res.status}: ${text.slice(0, 300)}`);
  }
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  return { res, json };
}

async function initMcp() {
  const token =
    process.env.SUPABASE_MCP_ACCESS_TOKEN ||
    process.env.SUPABASE_ACCESS_TOKEN ||
    process.env.SUPABASE_PAT;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const { res, json } = await mcpCall(
    'initialize',
    {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'gulf-coast-mcp-import', version: '1.0.0' },
    },
    null,
    headers
  );
  const sessionId = res.headers.get('mcp-session-id');
  return { headers, sessionId, initResult: json };
}

async function executeSql(headers, sessionId, query, attempt = 0) {
  const { json } = await mcpCall(
    'tools/call',
    { name: 'execute_sql', arguments: { project_id: PROJECT_ID, query } },
    sessionId,
    headers
  );
  const content = json.result?.content;
  const text = Array.isArray(content)
    ? content.map((c) => c.text || '').join('')
    : JSON.stringify(json.result);
  if (/rate limit|429/i.test(text) && attempt < 6) {
    const waitMs = Math.min(30000, 2000 * 2 ** attempt);
    console.error(`rate limited, retry in ${waitMs / 1000}s (attempt ${attempt + 1})`);
    await sleep(waitMs);
    return executeSql(headers, sessionId, query, attempt + 1);
  }
  if (json.result?.isError) throw new Error(text.slice(0, 500));
  return text;
}

async function main() {
  const files = listBatches();
  if (files.length === 0) {
    console.error('No batch files found');
    process.exit(1);
  }

  const { headers, sessionId } = await initMcp();
  const beforeRaw = await executeSql(headers, sessionId, COUNT_SQL);
  const beforeMatch = beforeRaw.match(/\{[^}]+\}/);
  const before = beforeMatch ? JSON.parse(beforeMatch[0]) : { total: '?', gulf_coast: '?' };
  console.log('Before:', before);

  const results = [];
  for (let i = 0; i < files.length; i += PARALLEL) {
    const wave = files.slice(i, i + PARALLEL);
    const waveResults = await Promise.all(
      wave.map(async (file) => {
        const sql = fs.readFileSync(path.join(BATCH_DIR, file), 'utf8');
        process.stdout.write(`${file} (${sql.length} bytes)… `);
        try {
          await executeSql(headers, sessionId, sql);
          console.log('OK');
          return { file, ok: true };
        } catch (err) {
          console.log('FAIL');
          return { file, ok: false, error: String(err.message || err) };
        }
      })
    );
    results.push(...waveResults);
  }

  await executeSql(headers, sessionId, 'ANALYZE public.locations;');
  const afterRaw = await executeSql(headers, sessionId, COUNT_SQL);
  const afterMatch = afterRaw.match(/\{[^}]+\}/);
  const after = afterMatch ? JSON.parse(afterMatch[0]) : { total: '?', gulf_coast: '?' };
  console.log('After:', after);

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(
    JSON.stringify(
      {
        batches_total: files.length,
        batches_succeeded: succeeded,
        batches_failed: failed.length,
        before,
        after,
        failed,
      },
      null,
      2
    )
  );
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
