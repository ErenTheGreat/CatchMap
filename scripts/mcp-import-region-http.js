#!/usr/bin/env node
/**
 * Import regional inject batches via Supabase MCP HTTP (Cursor OAuth session).
 * Usage: node scripts/mcp-import-region-http.js --dir .import/gulf_inject
 */
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/import-utils');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const MCP_URL =
  process.env.SUPABASE_MCP_URL ||
  `https://mcp.supabase.com/mcp?project_ref=${PROJECT_ID}&features=database`;
const PARALLEL = 3;

function listInjectFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => /^inject_\d+\.js$/.test(f))
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

  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), { requestInit: { headers } });
  const client = new Client({ name: 'region-import-http', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  return client;
}

async function executeSql(client, query) {
  const result = await client.callTool({
    name: 'execute_sql',
    arguments: { project_id: PROJECT_ID, query },
  });
  if (result.isError) throw new Error(JSON.stringify(result.content).slice(0, 500));
  return result;
}

async function main() {
  const args = parseArgs(process.argv);
  const projectRoot = path.join(__dirname, '..');
  const dir = path.resolve(projectRoot, args.options.dir || '.import/gulf_inject');
  const files = listInjectFiles(dir);
  if (files.length === 0) {
    console.error('No inject files in', dir);
    process.exit(1);
  }

  const client = await createClient();
  const before = JSON.parse(
    (await executeSql(client, 'SELECT COUNT(*)::int AS total FROM public.locations;')).content?.[0]
      ?.text || '[{"total":0}]'
  )[0]?.total;
  console.log('Before:', before);

  const results = [];
  for (let i = 0; i < files.length; i += PARALLEL) {
    const wave = files.slice(i, i + PARALLEL);
    await Promise.all(
      wave.map(async (file) => {
        const mod = require(path.join(dir, file));
        process.stdout.write(`${mod.file || file}… `);
        try {
          await executeSql(client, mod.query);
          console.log('OK');
          results.push({ file: mod.file || file, ok: true });
        } catch (e) {
          console.log('FAIL');
          results.push({ file: mod.file || file, ok: false, error: String(e.message || e).slice(0, 300) });
        }
      })
    );
  }

  await executeSql(client, 'ANALYZE public.locations;');
  const after = JSON.parse(
    (await executeSql(client, 'SELECT COUNT(*)::int AS total FROM public.locations;')).content?.[0]
      ?.text || '[{"total":0}]'
  )[0]?.total;
  console.log('After:', after, `(+${after - before})`);

  const failed = results.filter((r) => !r.ok);
  await client.close();
  if (failed.length) {
    console.error('Failed:', failed);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
