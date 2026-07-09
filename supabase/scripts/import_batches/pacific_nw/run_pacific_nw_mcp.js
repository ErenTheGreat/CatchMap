#!/usr/bin/env node
/**
 * Execute Pacific NW chunk SQL via Supabase MCP execute_sql (HTTP).
 * Reads per-chunk invoke JSON from .import/pacific_nw_exec/w*_c*.json
 * Runs in waves of 4 parallel calls.
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const INVOKE_DIR = path.join(__dirname, '../../../../.import/pacific_nw_exec');
const RESULT_FILE = path.join(__dirname, '_pacific_nw_import_result.json');
const PARALLEL = 4;
const COUNT_SQL = `SELECT count(*)::int AS total, count(*) FILTER (WHERE ST_Intersects(coordinates, ST_MakeEnvelope(-125, 42, -116, 49.5, 4326)::geography))::int AS pacific_nw FROM public.locations;`;

function listInvokes() {
  return fs
    .readdirSync(INVOKE_DIR)
    .filter((f) => /^w\d+_c\d+\.json$/.test(f))
    .sort((a, b) => {
      const pa = a.match(/w(\d+)_c(\d+)/);
      const pb = b.match(/w(\d+)_c(\d+)/);
      return +pa[1] - +pb[1] || +pa[2] - +pb[2];
    })
    .map((f) => {
      const j = JSON.parse(fs.readFileSync(path.join(INVOKE_DIR, f), 'utf8'));
      return { file: f, name: j.name, query: j.query };
    });
}

async function runMcpHttp() {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = await import(
    '@modelcontextprotocol/sdk/client/streamableHttp.js'
  );

  const transport = new StreamableHTTPClientTransport(
    new URL(`https://mcp.supabase.com/mcp?project_ref=${PROJECT_ID}&features=database`)
  );
  const client = new Client({ name: 'pacific-nw-import', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);

  return {
    async executeSql(query) {
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
    },
    close: () => client.close(),
  };
}

async function main() {
  const chunks = listInvokes();
  const backend = await runMcpHttp();

  const beforeRaw = await backend.executeSql(COUNT_SQL);
  const before = Array.isArray(beforeRaw) ? beforeRaw[0] : beforeRaw;
  console.log(`BEFORE: total=${before.total}, pacific_nw=${before.pacific_nw}`);

  const completed = [];
  const errors = [];

  for (let i = 0; i < chunks.length; i += PARALLEL) {
    const wave = chunks.slice(i, i + PARALLEL);
    const waveNum = Math.floor(i / PARALLEL) + 1;
    console.log(`\nWave ${waveNum}: ${wave.map((c) => c.name).join(', ')}`);

    await Promise.all(
      wave.map(async (chunk) => {
        process.stdout.write(`  RUN ${chunk.name} (${chunk.query.length}b)... `);
        try {
          await backend.executeSql(chunk.query);
          completed.push(chunk.name);
          console.log('OK');
        } catch (err) {
          errors.push({ chunk: chunk.name, error: String(err.message || err).slice(0, 500) });
          console.log('FAIL');
        }
      })
    );
  }

  console.log('\nANALYZE public.locations;');
  await backend.executeSql('ANALYZE public.locations;');

  const afterRaw = await backend.executeSql(COUNT_SQL);
  const after = Array.isArray(afterRaw) ? afterRaw[0] : afterRaw;
  console.log(`AFTER: total=${after.total}, pacific_nw=${after.pacific_nw}`);

  const summary = {
    project_id: PROJECT_ID,
    backend: 'mcp_http',
    before: { total: before.total, pacific_nw: before.pacific_nw },
    after: { total: after.total, pacific_nw: after.pacific_nw },
    added_total: Number(after.total) - Number(before.total),
    added_pacific_nw: Number(after.pacific_nw) - Number(before.pacific_nw),
    chunks_total: chunks.length,
    chunks_ok: completed.length,
    chunks_failed: errors.length,
    completed,
    errors,
  };

  fs.writeFileSync(RESULT_FILE, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  await backend.close();
  if (errors.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
