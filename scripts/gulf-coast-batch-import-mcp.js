#!/usr/bin/env node
/**
 * Import Gulf Coast batch_001..batch_012 via Supabase MCP execute_sql (stdio).
 * Waves of 3, exponential backoff on HTTP 429.
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const BATCH_DIR = path.join(__dirname, '../supabase/scripts/import_batches/gulf_coast');
const PARALLEL = 3;
const COUNT_SQL = `SELECT count(*)::int AS total,
  count(*) FILTER (WHERE ST_Intersects(coordinates, ST_MakeEnvelope(-97.5, 24, -80, 35, 4326)::geography)) AS gulf_coast
  FROM public.locations;`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function listBatches() {
  return fs
    .readdirSync(BATCH_DIR)
    .filter((f) => /^batch_\d{3}\.sql$/.test(f))
    .sort();
}

async function createClient(token) {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  const transport = new StdioClientTransport({
    command: 'npx',
    args: [
      '--yes',
      '@supabase/mcp-server-supabase',
      `--access-token=${token}`,
      `--project-ref=${PROJECT_ID}`,
    ],
  });
  const client = new Client({ name: 'gulf-coast-import', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  return client;
}

async function executeSql(client, query, attempt = 0) {
  try {
    const result = await client.callTool({
      name: 'execute_sql',
      arguments: { query },
    });
    if (result.isError) {
      const msg = JSON.stringify(result.content);
      if (/429|rate.?limit/i.test(msg) && attempt < 6) {
        const waitMs = Math.min(30000, 2000 * 2 ** attempt);
        console.error(`rate limited, retry in ${waitMs / 1000}s (attempt ${attempt + 1})`);
        await sleep(waitMs);
        return executeSql(client, query, attempt + 1);
      }
      throw new Error(msg.slice(0, 500));
    }
    const text = result.content?.map((c) => c.text).join('') || '';
    return text;
  } catch (e) {
    const msg = String(e.message || e);
    if (/429|rate.?limit/i.test(msg) && attempt < 6) {
      const waitMs = Math.min(30000, 2000 * 2 ** attempt);
      console.error(`rate limited, retry in ${waitMs / 1000}s (attempt ${attempt + 1})`);
      await sleep(waitMs);
      return executeSql(client, query, attempt + 1);
    }
    throw e;
  }
}

function parseRows(text) {
  try {
    const rows = JSON.parse(text);
    return Array.isArray(rows) ? rows[0] : rows;
  } catch {
    return null;
  }
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  if (!token) {
    console.error('ERROR: Set SUPABASE_ACCESS_TOKEN');
    process.exit(1);
  }

  const files = listBatches();
  const client = await createClient(token);

  const beforeText = await executeSql(client, COUNT_SQL);
  const before = parseRows(beforeText) || { total: null, gulf_coast: null };
  console.log('Before:', JSON.stringify(before));

  const results = [];
  for (let i = 0; i < files.length; i += PARALLEL) {
    const wave = files.slice(i, i + PARALLEL);
    const waveResults = await Promise.all(
      wave.map(async (file) => {
        const sql = fs.readFileSync(path.join(BATCH_DIR, file), 'utf8');
        process.stdout.write(`${file} (${sql.length} bytes)… `);
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
  const afterText = await executeSql(client, COUNT_SQL);
  const after = parseRows(afterText) || { total: null, gulf_coast: null };

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const summary = {
    batches_total: files.length,
    batches_succeeded: succeeded,
    batches_failed: failed.length,
    before,
    after,
    errors: failed,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
