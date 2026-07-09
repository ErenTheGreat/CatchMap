#!/usr/bin/env node
/**
 * Import regional waterbody batches via Supabase MCP execute_sql.
 * Reads inject_*.js files produced from SQL batches.
 *
 * Usage:
 *   node scripts/mcp-import-region-inject.js --dir .import/gulf_inject
 *   SUPABASE_ACCESS_TOKEN=... node scripts/mcp-import-region-inject.js --dir .import/gulf_inject
 */
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/import-utils');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const PARALLEL = 3;

function listInjectFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => /^inject_\d+\.js$/.test(f))
    .sort();
}

async function runViaMcpStdio(dir, files) {
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  if (!token) return false;

  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['--yes', '@supabase/mcp-server-supabase', `--access-token=${token}`, `--project-ref=${PROJECT_ID}`],
  });
  const client = new Client({ name: 'region-import', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);

  async function executeSql(query) {
    const result = await client.callTool({
      name: 'execute_sql',
      arguments: { project_id: PROJECT_ID, query },
    });
    if (result.isError) throw new Error(JSON.stringify(result.content));
    const text = result.content?.map((c) => c.text).join('') || '';
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  const beforeRows = await executeSql('SELECT COUNT(*)::int AS total FROM public.locations;');
  const before = beforeRows[0]?.total ?? 0;
  console.log('Before:', before);

  const results = [];
  for (let i = 0; i < files.length; i += PARALLEL) {
    const wave = files.slice(i, i + PARALLEL);
    await Promise.all(
      wave.map(async (file) => {
        const mod = require(path.join(dir, file));
        process.stdout.write(`${mod.file || file}… `);
        try {
          await executeSql(mod.query);
          console.log('OK');
          results.push({ file: mod.file || file, ok: true });
        } catch (e) {
          console.log('FAIL');
          results.push({ file: mod.file || file, ok: false, error: String(e.message || e).slice(0, 300) });
        }
      })
    );
  }

  await executeSql('ANALYZE public.locations;');
  const afterRows = await executeSql('SELECT COUNT(*)::int AS total FROM public.locations;');
  const after = afterRows[0]?.total ?? 0;
  console.log('After:', after, `(+${after - before})`);

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error('Failed:', failed);
    process.exit(1);
  }
  await client.close();
  return true;
}

async function main() {
  const args = parseArgs(process.argv);
  const projectRoot = path.join(__dirname, '..');
  const dir = path.resolve(projectRoot, args.options.dir || '.import/gulf_inject');
  const files = listInjectFiles(dir);
  if (files.length === 0) {
    console.error('No inject_*.js files in', dir);
    process.exit(1);
  }

  const ran = await runViaMcpStdio(dir, files);
  if (ran) return;

  console.error(`Set SUPABASE_ACCESS_TOKEN to import ${files.length} batches from ${dir}`);
  console.log(JSON.stringify({ mode: 'call_mcp_tool', project_id: PROJECT_ID, dir, files, parallel: PARALLEL }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
