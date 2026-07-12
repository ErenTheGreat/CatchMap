#!/usr/bin/env node
/**
 * Import all Great Lakes chunks via Supabase MCP execute_sql (stdio).
 * Reads chunk SQL with Node; executes in waves of 4 parallel MCP calls.
 *
 * Requires SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens).
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const CHUNK_DIR = path.join(__dirname, '_chunks');
const PARALLEL = 4;
const RESULT_FILE = path.join(__dirname, '_great_lakes_import_result.json');

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

  const client = new Client({ name: 'great-lakes-import', version: '1.0.0' }, { capabilities: {} });
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
  const rows = await executeSql(
    `SELECT COUNT(*) AS total_locations,
      COUNT(*) FILTER (WHERE ST_Intersects(coordinates, ST_MakeEnvelope(-92.5, 41.0, -76.0, 49.5, 4326)::geography)) AS great_lakes_count
      FROM public.locations;`
  );
  const row = Array.isArray(rows) ? rows[0] : rows;
  console.log(`${label}: total=${row.total_locations}, great_lakes=${row.great_lakes_count}`);
  return row;
}

async function main() {
  const chunks = listChunks();
  console.log(`Found ${chunks.length} chunk files`);

  const { executeSql, close } = await runMcpImport();

  try {
    const before = await countQuery(executeSql, 'BEFORE');
    const completed = [];
    const errors = [];

    for (let i = 0; i < chunks.length; i += PARALLEL) {
      const wave = chunks.slice(i, i + PARALLEL);
      const waveNum = Math.floor(i / PARALLEL) + 1;
      console.log(`\nWave ${waveNum}/${Math.ceil(chunks.length / PARALLEL)}: ${wave.join(', ')}`);

      await Promise.all(
        wave.map(async (name) => {
          const sql = fs.readFileSync(path.join(CHUNK_DIR, name), 'utf8');
          process.stdout.write(`  RUN ${name} (${sql.length} bytes)... `);
          try {
            await executeSql(sql);
            completed.push(name);
            console.log('OK');
          } catch (err) {
            errors.push({ name, error: String(err.message || err) });
            console.log('FAIL');
          }
        })
      );
    }

    console.log('\nRunning ANALYZE public.locations;');
    await executeSql('ANALYZE public.locations;');
    console.log('ANALYZE OK');

    const after = await countQuery(executeSql, 'AFTER');

    const summary = {
      project_id: PROJECT_ID,
      chunks_total: chunks.length,
      chunks_ok: completed.length,
      chunks_failed: errors.length,
      before,
      after,
      added_total: Number(after.total_locations) - Number(before.total_locations),
      added_great_lakes: Number(after.great_lakes_count) - Number(before.great_lakes_count),
      errors,
      completed,
    };

    fs.writeFileSync(RESULT_FILE, JSON.stringify(summary, null, 2));
    console.log(`\nResult: ${RESULT_FILE}`);
    console.log(JSON.stringify(summary, null, 2));

    if (errors.length) process.exit(1);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
