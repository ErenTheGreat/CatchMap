#!/usr/bin/env node
/**
 * Run all pending mini-chunks via Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN or SUPABASE_DB_PASSWORD.
 * Falls back with instructions for MCP agent loop.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadEnv, connectPg } = require('./lib/import-utils');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;
const MINI_DIR = path.join(__dirname, '../.import/mini_chunks');
const MANIFEST = path.join(MINI_DIR, 'manifest.json');
const STATUS = path.join(__dirname, '../.import/ca_mini_status.json');
const RUNNER = path.join(__dirname, 'mcp-mini-chunk-runner.js');
const PARALLEL = Number(process.env.MINI_PARALLEL || 4);

async function postSql(token, query) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 400)}`);
  return text;
}

function markOk(key) {
  spawnSync(process.execPath, [RUNNER, '--mark-ok', '--key', key], { stdio: 'pipe' });
}

function markFail(key, error) {
  spawnSync(process.execPath, [RUNNER, '--mark-fail', '--key', key, '--error', String(error).slice(0, 500)], {
    stdio: 'pipe',
  });
}

function pendingKeys() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const status = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
  const ok = new Set(status.ok);
  return manifest.mini.map((m) => m.key).sort().filter((k) => !ok.has(k));
}

async function runViaApi(token, pending, before) {
  const failed = [];
  for (let i = 0; i < pending.length; i += PARALLEL) {
    const wave = pending.slice(i, i + PARALLEL);
    await Promise.all(
      wave.map(async (key) => {
        const sql = fs.readFileSync(path.join(MINI_DIR, `${key}.sql`), 'utf8');
        process.stdout.write(`${key} (${sql.length}b)… `);
        try {
          await postSql(token, sql);
          markOk(key);
          console.log('OK');
        } catch (err) {
          console.log('FAIL', err.message);
          markFail(key, err.message);
          failed.push({ key, error: err.message });
        }
      })
    );
    if (failed.length) break;
  }
  return failed;
}

async function runViaPg(client, pending) {
  const failed = [];
  for (const key of pending) {
    const sql = fs.readFileSync(path.join(MINI_DIR, `${key}.sql`), 'utf8');
    process.stdout.write(`${key} (${sql.length}b)… `);
    try {
      await client.query(sql);
      markOk(key);
      console.log('OK');
    } catch (err) {
      console.log('FAIL', err.message);
      markFail(key, err.message);
      failed.push({ key, error: err.message });
      break;
    }
  }
  return failed;
}

async function finalize(before) {
  spawnSync(process.execPath, [RUNNER, '--parents-done'], { stdio: 'inherit' });
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  const { projectRef, password } = loadEnv(path.join(__dirname, '..'));
  let after, ca, cats;
  if (password) {
    const client = await connectPg(projectRef, password);
    await client.query('ANALYZE public.locations;');
    after = (await client.query('SELECT count(*)::int AS n FROM public.locations')).rows[0].n;
    ca = (
      await client.query(`
        SELECT count(*)::int AS n FROM public.locations
        WHERE ST_Y(coordinates::geometry) BETWEEN 32.5 AND 42.0
          AND ST_X(coordinates::geometry) BETWEEN -124.5 AND -114.0
      `)
    ).rows[0].n;
    cats = (await client.query('SELECT category, count(*)::int AS n FROM public.locations GROUP BY 1 ORDER BY 1')).rows;
    await client.end();
  } else if (token) {
    await postSql(token, 'ANALYZE public.locations;');
    after = JSON.parse(await postSql(token, 'SELECT count(*)::int AS n FROM public.locations'))[0].n;
    ca = JSON.parse(
      await postSql(
        token,
        `SELECT count(*)::int AS n FROM public.locations WHERE ST_Y(coordinates::geometry) BETWEEN 32.5 AND 42.0 AND ST_X(coordinates::geometry) BETWEEN -124.5 AND -114.0`
      )
    )[0].n;
    cats = JSON.parse(
      await postSql(token, 'SELECT category, count(*)::int AS n FROM public.locations GROUP BY 1 ORDER BY 1')
    );
  }
  const status = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
  console.log(
    JSON.stringify(
      {
        done: true,
        before,
        after,
        rows_added: after - before,
        ca_bbox: ca,
        categories: cats,
        mini_ok: status.ok.length,
        mini_failed: status.failed.length,
      },
      null,
      2
    )
  );
}

async function main() {
  const status = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
  const pending = pendingKeys();
  const before = status.before || 2778;
  console.log(JSON.stringify({ before, pending: pending.length, next: pending[0] || null }));

  if (!pending.length) {
    await finalize(before);
    return;
  }

  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT;
  const { projectRef, password } = loadEnv(path.join(__dirname, '..'));

  let failed = [];
  if (token) {
    failed = await runViaApi(token, pending, before);
  } else if (password) {
    const client = await connectPg(projectRef, password);
    failed = await runViaPg(client, pending);
    await client.end();
  } else {
    console.error('No SUPABASE_ACCESS_TOKEN or SUPABASE_DB_PASSWORD — use MCP execute_sql loop');
    process.exit(1);
  }

  if (!failed.length && !pendingKeys().length) {
    await finalize(before);
  } else if (failed.length) {
    console.error(JSON.stringify({ failed }, null, 2));
    process.exit(1);
  } else {
    const remaining = pendingKeys().length;
    console.log(JSON.stringify({ partial: true, remaining }));
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
