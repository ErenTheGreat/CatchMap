#!/usr/bin/env node
/**
 * Pacific NW import via Supabase MCP execute_sql (stdio).
 * Mirrors great_lakes/run_import_mcp_stdio.js
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const CHUNK_DIR = path.join(__dirname, '_chunks');
const PARALLEL = 4;
const RESULT_FILE = path.join(__dirname, '_pacific_nw_import_result.json');

const COUNT_SQL = `SELECT count(*)::int AS total,
  count(*) FILTER (WHERE ST_Intersects(coordinates, ST_MakeEnvelope(-125, 42, -116, 49.5, 4326)::geography))::int AS pacific_nw
  FROM public.locations;`;

const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
if (!token) {
  console.error('ERROR: Set SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

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

async function runMcpImport() {
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

  const client = new Client({ name: 'pacific-nw-import', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);

  async function executeSql(query) {
    const result = await client.callTool({
      name: 'execute_sql',
      arguments: { project_id: PROJECT_ID, query },
    });
    if (result.isError) {
      throw new Error(JSON.stringify(result.content));
    }
    const text = result.content?.map((c) => c.text).join('') || '';
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return { executeSql, close: () => client.close() };
}

async function countQuery(executeSql, label) {
  const rows = await executeSql(COUNT_SQL);
  const row = Array.isArray(rows) ? rows[0] : rows;
  console.log(`${label}: total=${row.total}, pacific_nw=${row.pacific_nw}`);
  return row;
}

async function main() {
  const chunks = listChunks();
  const result = {
    project_id: PROJECT_ID,
    chunks_total: chunks.length,
    chunks_ok: 0,
    chunks_failed: 0,
    before: null,
    after: null,
    added_total: 0,
    added_pacific_nw: 0,
    errors: [],
    completed: [],
  };

  const { executeSql, close } = await runMcpImport();
  try {
    result.before = await countQuery(executeSql, 'before');

    for (let i = 0; i < chunks.length; i += PARALLEL) {
      const wave = chunks.slice(i, i + PARALLEL);
      const outcomes = await Promise.allSettled(
        wave.map(async (name) => {
          const query = fs.readFileSync(path.join(CHUNK_DIR, name), 'utf8');
          await executeSql(query);
          return name;
        })
      );
      for (let j = 0; j < outcomes.length; j++) {
        const o = outcomes[j];
        const name = wave[j];
        if (o.status === 'fulfilled') {
          result.chunks_ok++;
          result.completed.push(name);
          console.log('OK', name);
        } else {
          result.chunks_failed++;
          result.errors.push({ chunk: name, error: String(o.reason) });
          console.error('FAIL', name, o.reason);
        }
      }
    }

    await executeSql('ANALYZE public.locations;');
    result.after = await countQuery(executeSql, 'after');
    result.added_total = result.after.total - result.before.total;
    result.added_pacific_nw = result.after.pacific_nw - result.before.pacific_nw;
  } finally {
    await close();
  }

  fs.writeFileSync(RESULT_FILE, JSON.stringify(result, null, 2) + '\n');
  console.log('Wrote', RESULT_FILE);
  process.exit(result.chunks_failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
