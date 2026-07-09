#!/usr/bin/env node
/**
 * Execute all pending mini-chunk SQL files via direct Postgres connection.
 * Falls back with exit 1 if SUPABASE_DB_PASSWORD is not set (use MCP loop).
 *
 * Usage:
 *   node scripts/run-pending-mini-chunks-pg.js
 *   node scripts/run-pending-mini-chunks-pg.js --limit 20
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadEnv, connectPg } = require('./lib/import-utils');

const MINI_DIR = path.join(__dirname, '../.import/mini_chunks');
const MANIFEST = path.join(MINI_DIR, 'manifest.json');
const STATUS = path.join(__dirname, '../.import/ca_mini_status.json');
const RUNNER = path.join(__dirname, 'mcp-mini-chunk-runner.js');

function markOk(key) {
  spawnSync(process.execPath, [RUNNER, '--mark-ok', '--key', key], { stdio: 'pipe' });
}

async function main() {
  const limitIdx = process.argv.indexOf('--limit');
  const limit = limitIdx >= 0 ? Number(process.argv[limitIdx + 1]) || 0 : 0;

  const { projectRef, password } = loadEnv(path.join(__dirname, '..'));
  if (!password) {
    console.error('SUPABASE_DB_PASSWORD not set — use MCP execute_sql loop');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const status = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
  const ok = new Set(status.ok);
  let pending = manifest.mini.map((m) => m.key).sort().filter((k) => !ok.has(k));
  if (limit > 0) pending = pending.slice(0, limit);

  const client = await connectPg(projectRef, password);
  const beforeRes = await client.query('SELECT count(*)::int AS n FROM public.locations;');
  const before = beforeRes.rows[0]?.n ?? status.before;
  console.log(JSON.stringify({ before, pending: pending.length }));

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
      failed.push({ key, error: err.message });
      break;
    }
  }

  if (failed.length === 0 && pending.length > 0) {
    const remaining = manifest.mini.map((m) => m.key).sort().filter((k) => {
      const s = JSON.parse(fs.readFileSync(STATUS, 'utf8'));
      return !s.ok.includes(k);
    });
    if (remaining.length === 0) {
      spawnSync(process.execPath, [RUNNER, '--parents-done'], { stdio: 'inherit' });
      await client.query('ANALYZE public.locations;');
      const afterRes = await client.query('SELECT count(*)::int AS n FROM public.locations;');
      const caRes = await client.query(`
        SELECT count(*)::int AS n FROM public.locations
        WHERE ST_Y(coordinates::geometry) BETWEEN 32.5 AND 42
          AND ST_X(coordinates::geometry) BETWEEN -124.5 AND -114;
      `);
      const catRes = await client.query(
        'SELECT category, count(*)::int AS n FROM public.locations GROUP BY 1 ORDER BY 1;'
      );
      console.log(
        JSON.stringify({
          done: true,
          before,
          after: afterRes.rows[0]?.n,
          rows_added: (afterRes.rows[0]?.n ?? 0) - before,
          ca_count: caRes.rows[0]?.n,
          categories: catRes.rows,
        })
      );
    }
  }

  await client.end();
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
