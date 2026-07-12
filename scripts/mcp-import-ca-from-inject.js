#!/usr/bin/env node
/**
 * Import CA chunks 2-42 via Supabase MCP execute_sql (stdio).
 * Uses SUPABASE_ACCESS_TOKEN when set; otherwise prints chunk numbers for agent CallMcpTool.
 *
 * Usage:
 *   node scripts/mcp-import-ca-from-inject.js --from 2 --to 42
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/mcp-import-ca-from-inject.js --from 2 --to 42
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const PARALLEL = 4;
const STATUS_PATH = path.join(__dirname, '../.import/ca_chunks/import_status.json');

function loadStatus() {
  if (fs.existsSync(STATUS_PATH)) {
    return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
  }
  return { baseline: 2778, ok: [], failed: [], partial: true };
}

function saveStatus(s) {
  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
  fs.writeFileSync(STATUS_PATH, JSON.stringify(s, null, 2));
}

function chunkFile(n) {
  return `chunk_${String(n).padStart(4, '0')}.sql`;
}

function loadArgs(n) {
  const inject = path.join(__dirname, `../.import/ca_chunks/.inject_${n}.js`);
  if (!fs.existsSync(inject)) {
    const call = path.join(__dirname, `../.import/ca_chunks/_call_${n}.json`);
    if (!fs.existsSync(call)) {
      require('child_process').execFileSync(process.execPath, [
        path.join(__dirname, 'load-mcp-chunk-args.js'),
        String(n),
      ], { stdio: ['ignore', fs.openSync(call, 'w'), 'inherit'] });
    }
    const args = JSON.parse(fs.readFileSync(call, 'utf8'));
    fs.writeFileSync(inject, `module.exports=${JSON.stringify(args)}`);
  }
  return require(inject);
}

async function runViaMcpStdio(from, to) {
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  if (!token) return false;

  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['--yes', '@supabase/mcp-server-supabase', `--access-token=${token}`, `--project-ref=${PROJECT_ID}`],
  });
  const client = new Client({ name: 'ca-chunk-import', version: '1.0.0' }, { capabilities: {} });
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

  const status = loadStatus();
  const beforeRows = await executeSql('SELECT COUNT(*)::int AS total FROM public.locations;');
  const before = beforeRows[0]?.total ?? 0;
  console.log(JSON.stringify({ before, from, to }));

  for (let start = from; start <= to; start += PARALLEL) {
    const batch = [];
    for (let n = start; n < start + PARALLEL && n <= to; n++) batch.push(n);
    await Promise.all(
      batch.map(async (n) => {
        const file = chunkFile(n);
        const { query } = loadArgs(n);
        try {
          await executeSql(query);
          if (!status.ok.includes(file)) status.ok.push(file);
          status.failed = (status.failed || []).filter((f) => f.file !== file);
          saveStatus(status);
          console.log(JSON.stringify({ n, file, ok: true }));
        } catch (e) {
          const err = String(e.message || e).slice(0, 500);
          if (!status.failed.some((f) => f.file === file)) {
            status.failed.push({ file, error: err });
          }
          saveStatus(status);
          console.log(JSON.stringify({ n, file, ok: false, error: err }));
        }
      })
    );
  }

  await executeSql('ANALYZE public.locations;');
  const afterRows = await executeSql('SELECT COUNT(*)::int AS total FROM public.locations;');
  const after = afterRows[0]?.total ?? 0;
  const bboxRows = await executeSql(
    `SELECT COUNT(*)::int AS n FROM public.locations
     WHERE ST_X(coordinates::geometry) BETWEEN -124.5 AND -114.0
       AND ST_Y(coordinates::geometry) BETWEEN 32.5 AND 42.2;`
  );
  const caBbox = bboxRows[0]?.n ?? 0;
  const catRows = await executeSql(
    'SELECT category, COUNT(*)::int AS n FROM public.locations GROUP BY 1 ORDER BY 1;'
  );
  const categories = {};
  for (const row of catRows) categories[row.category] = row.n;

  status.partial = false;
  status.completedAt = new Date().toISOString();
  status.beforeCount = before;
  status.currentCount = after;
  status.added = after - before;
  status.caBbox = caBbox;
  status.categories = categories;
  status.note = 'CA chunks 2-42 import complete';
  saveStatus(status);

  console.log(JSON.stringify({ before, after, added: after - before, caBbox, categories }));
  await client.close();
  return true;
}

async function main() {
  const fromIdx = process.argv.indexOf('--from');
  const toIdx = process.argv.indexOf('--to');
  const from = fromIdx >= 0 ? Number(process.argv[fromIdx + 1]) : 2;
  const to = toIdx >= 0 ? Number(process.argv[toIdx + 1]) : 42;

  const ran = await runViaMcpStdio(from, to);
  if (ran) return;

  // No token — emit wave plan for agent CallMcpTool loop
  const waves = [];
  for (let start = from; start <= to; start += PARALLEL) {
    const batch = [];
    for (let n = start; n < start + PARALLEL && n <= to; n++) batch.push(n);
    waves.push(batch);
  }
  console.log(JSON.stringify({ mode: 'call_mcp_tool', project_id: PROJECT_ID, from, to, waves }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
