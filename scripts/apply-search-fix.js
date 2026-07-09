#!/usr/bin/env node
/**
 * Applies supabase/migrations/20260706210000_013_fix_search_fishing_spots_rpc.sql
 * Usage: node scripts/apply-search-fix.js
 */
const fs = require('fs');
const path = require('path');

async function verifySearchRpc(projectUrl, anonKey) {
  const res = await fetch(`${projectUrl}/rest/v1/rpc/search_fishing_spots`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ search_term: 'Del Valle' }),
  });
  const rows = await res.json();
  const sample = rows[0];
  const ok =
    Array.isArray(rows) &&
    rows.length > 0 &&
    sample &&
    Number.isFinite(Number(sample.latitude)) &&
    Number.isFinite(Number(sample.longitude));
  console.log(
    ok
      ? `REST verify OK — ${rows.length} results, sample lat/lng: ${sample.latitude}, ${sample.longitude}`
      : `REST verify pending — RPC still returns raw rows (${JSON.stringify(sample).slice(0, 120)}…)`
  );
  return ok;
}

async function main() {
  const projectRoot = path.join(__dirname, '..');
  const envPath = path.join(projectRoot, '.env');
  const env = fs.readFileSync(envPath, 'utf8');
  let password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) {
    const match = env.match(/^SUPABASE_DB_PASSWORD=(.+)$/m);
    if (match) password = match[1].trim().replace(/^["']|["']$/g, '');
  }

  const urlMatch = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/);
  const anonMatch = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
  if (!urlMatch || !password) {
    console.error('Need EXPO_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in .env');
    process.exit(1);
  }

  const projectUrl = urlMatch[1].trim();
  const anonKey = anonMatch?.[1]?.trim();
  const projectRef = new URL(projectUrl).hostname.split('.')[0];
  const sqlPath = path.join(
    projectRoot,
    'supabase/migrations/20260706210000_013_fix_search_fishing_spots_rpc.sql'
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const { Client } = require('pg');
  const ssl = { rejectUnauthorized: false };
  const candidates = [
    {
      label: 'pooler us-west-1 session',
      config: {
        host: 'aws-0-us-west-1.pooler.supabase.com',
        port: 5432,
        user: `postgres.${projectRef}`,
        password,
        database: 'postgres',
        ssl,
      },
    },
    {
      label: 'direct postgres',
      config: {
        host: `db.${projectRef}.supabase.co`,
        port: 5432,
        user: 'postgres',
        password,
        database: 'postgres',
        ssl,
      },
    },
  ];

  let lastError = null;
  for (const candidate of candidates) {
    const client = new Client(candidate.config);
    try {
      console.log(`Connecting via ${candidate.label}…`);
      await client.connect();
      console.log('Applying search_fishing_spots fix…');
      await client.query(sql);
      await client.end();
      if (anonKey) {
        await verifySearchRpc(projectUrl, anonKey);
      }
      console.log('\nDone. Reload the app and search for a lake name.');
      return;
    } catch (error) {
      lastError = error;
      console.warn(`${candidate.label}: ${error.message}`);
      try {
        await client.end();
      } catch {
        // ignore
      }
    }
  }

  throw lastError ?? new Error('Could not connect to Supabase Postgres');
}

main().catch((err) => {
  console.error('Deploy failed:', err.message);
  process.exit(1);
});
