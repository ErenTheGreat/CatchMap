#!/usr/bin/env node
/**
 * Import Gulf Coast batch SQL via Supabase MCP HTTP (Cursor OAuth when no token).
 * Usage: node scripts/gulf-coast-mcp-http-import.js
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const MCP_URL =
  process.env.SUPABASE_MCP_URL ||
  `https://mcp.supabase.com/mcp?project_ref=${PROJECT_ID}&features=database`;
const BATCH_DIR = path.join(__dirname, '../.import/mcp_run/gulf_coast');
const PARALLEL = 3;
const RESULT_FILE = path.join(BATCH_DIR, '_gulf_coast_import_result.json');
const COUNT_SQL = `SELECT count(*) FILTER (WHERE ST_Intersects(coordinates, ST_MakeEnvelope(-97.5, 24, -80, 35, 4326)::geography))::int AS gulf_coast FROM public.locations;`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function listBatches() {
  return fs
    .readdirSync(BATCH_DIR)
    .filter((f) => /^batch_\d{3}\.sql$/.test(f))
    .sort();
}

async function createClient() {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = await import(
    '@modelcontextprotocol/sdk/client/streamableHttp.js'
  );
  const headers = {};
  const token =
    process.env.SUPABASE_MCP_ACCESS_TOKEN ||
    process.env.SUPABASE_ACCESS_TOKEN ||
    process.env.SUPABASE_PAT;
  if (token) headers.Authorization = `Bearer ${token}`;
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers },
  });
  const client = new Client({ name: 'gulf-coast-mcp-http', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  return client;
}

async function executeSql(client, query, attempt = 0) {
  try {
    const result = await client.callTool({
      name: 'execute_sql',
      arguments: { project_id: PROJECT_ID, query },
    });
    if (result.isError) {
      const msg = JSON.stringify(result.content);
      if (/429|rate.?limit/i.test(msg) && attempt < 6) {
        const waitMs = Math.min(30000, 2000 * 2 ** attempt);
        await sleep(waitMs);
        return executeSql(client, query, attempt + 1);
      }
      throw new Error(msg.slice(0, 500));
    }
    return result;
  } catch (e) {
    const msg = String(e.message || e);
    if (/429|rate.?limit/i.test(msg) && attempt < 6) {
      const waitMs = Math.min(30000, 2000 * 2 ** attempt);
      await sleep(waitMs);
      return executeSql(client, query, attempt + 1);
    }
    throw e;
  }
}

function parseCount(result) {
  const text = result.content?.map((c) => c.text).join('') || '[]';
  try {
    return JSON.parse(text)[0];
  } catch {
    return { gulf_coast: null };
  }
}

async function main() {
  const files = listBatches();
  const client = await createClient();

  const before = parseCount(await executeSql(client, COUNT_SQL));
  console.log('Before:', before);

  const results = [];
  for (let i = 0; i < files.length; i += PARALLEL) {
    const wave = files.slice(i, i + PARALLEL);
    console.log(`Wave ${Math.floor(i / PARALLEL) + 1}: ${wave.join(', ')}`);
    const waveResults = await Promise.all(
      wave.map(async (file) => {
        const sql = fs.readFileSync(path.join(BATCH_DIR, file), 'utf8');
        process.stdout.write(`  ${file} (${sql.length}b)… `);
        try {
          await executeSql(client, sql);
          console.log('OK');
          return { file, ok: true };
        } catch (e) {
          console.log('FAIL');
          return { file, ok: false, error: String(e.message || e).slice(0, 500) };
        }
      })
    );
    results.push(...waveResults);
  }

  await executeSql(client, 'ANALYZE public.locations;');
  const after = parseCount(await executeSql(client, COUNT_SQL));

  const summary = {
    batches_total: files.length,
    batches_succeeded: results.filter((r) => r.ok).length,
    batches_failed: results.filter((r) => !r.ok).length,
    gulf_coast_before: before.gulf_coast,
    gulf_coast_after: after.gulf_coast,
    errors: results.filter((r) => !r.ok),
    completed_at: new Date().toISOString(),
  };

  fs.writeFileSync(RESULT_FILE, JSON.stringify(summary, null, 2));
  fs.writeFileSync(
    path.join(BATCH_DIR, '_import_status.json'),
    JSON.stringify(
      {
        succeeded: results.filter((r) => r.ok).map((r) => r.file),
        errors: summary.errors,
        pending: results.filter((r) => !r.ok).map((r) => r.file),
        completed_at: summary.completed_at,
        gulf_coast_count: after.gulf_coast,
      },
      null,
      2
    )
  );

  console.log(JSON.stringify(summary, null, 2));
  await client.close();
  if (summary.batches_failed) process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
