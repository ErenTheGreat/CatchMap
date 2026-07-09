#!/usr/bin/env node
/**
 * Applies supabase/apply_map_pins_fix.sql to your remote Supabase database.
 *
 * Usage (from project/):
 *   npm run db:deploy
 *
 * Requires SUPABASE_DB_PASSWORD in .env (Dashboard → Project Settings → Database).
 */

const fs = require('fs');
const path = require('path');

async function verifyViaRest(projectUrl, anonKey) {
  const res = await fetch(`${projectUrl}/rest/v1/rpc/get_categorized_spots_in_bbox`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_min_lat: 37.55,
      p_max_lat: 37.75,
      p_min_lng: -122.15,
      p_max_lng: -121.70,
    }),
  });

  const body = await res.json();
  if (body?.code === 'PGRST202') {
    console.warn('REST verify: RPC not in schema cache yet — reload API schema in Supabase Settings.');
    return false;
  }

  const sample = JSON.stringify(body).slice(0, 200);
  console.log('REST verify OK — discovery RPC sample:', sample);
  return true;
}

async function main() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env not found');
    process.exit(1);
  }

  const env = fs.readFileSync(envPath, 'utf8');
  let password = process.env.SUPABASE_DB_PASSWORD;
  const urlMatch = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/);
  const anonMatch = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/);

  if (!password) {
    const match = env.match(/^SUPABASE_DB_PASSWORD=(.+)$/m);
    if (match) password = match[1].trim().replace(/^["']|["']$/g, '');
  }

  if (!password) {
    console.error(
      'Add your database password to .env:\n\n' +
        '  SUPABASE_DB_PASSWORD=your_password_here\n\n' +
        'Find it: Supabase Dashboard → Project Settings → Database → Database password\n' +
        'Then run: npm run db:deploy'
    );
    process.exit(1);
  }

  if (!urlMatch) {
    console.error('EXPO_PUBLIC_SUPABASE_URL not found in .env');
    process.exit(1);
  }

  const projectUrl = urlMatch[1].trim();
  const anonKey = anonMatch?.[1]?.trim();
  const projectRef = new URL(projectUrl).hostname.split('.')[0];

  const { Client } = require('pg');

  const ssl = { rejectUnauthorized: false };
  const connectionCandidates = [
    process.env.SUPABASE_DB_URL && { label: 'SUPABASE_DB_URL', config: { connectionString: process.env.SUPABASE_DB_URL, ssl } },
    {
      label: 'pooler us-west-1 session (5432)',
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
      label: 'pooler us-west-1 transaction (6543)',
      config: {
        host: 'aws-0-us-west-1.pooler.supabase.com',
        port: 6543,
        user: `postgres.${projectRef}`,
        password,
        database: 'postgres',
        ssl,
      },
    },
    {
      label: 'direct postgres (5432)',
      config: {
        host: `db.${projectRef}.supabase.co`,
        port: 5432,
        user: 'postgres',
        password,
        database: 'postgres',
        ssl,
      },
    },
  ].filter(Boolean);

  const sqlPath = path.join(__dirname, '..', 'supabase', 'apply_map_pins_fix.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  if (!sql.trim().startsWith('/*') || sql.includes('Root cause (Supabase')) {
    console.error('apply_map_pins_fix.sql looks corrupted — rebuild from supabase/migrations/');
    process.exit(1);
  }

  let lastError = null;
  for (const candidate of connectionCandidates) {
    const client = new Client(candidate.config);

    try {
      console.log(`Connecting via ${candidate.label} (${projectRef})…`);
      await client.connect();
      console.log('Running apply_map_pins_fix.sql (681 lines)…');
      await client.query(sql);

      const { rows } = await client.query(
        'SELECT count(*)::int AS n FROM public.locations'
      );
      console.log('Locations seeded:', rows[0]?.n ?? 0);

      const discovery = await client.query(
        'SELECT public.get_categorized_spots_in_bbox(37.55, 37.75, -122.15, -121.70) AS sample'
      );
      console.log(
        'Discovery RPC sample:',
        JSON.stringify(discovery.rows[0]?.sample).slice(0, 300)
      );

      await client.end();

      if (anonKey) {
        await verifyViaRest(projectUrl, anonKey);
      }

      console.log('\nDone. Restart Expo and pan the map to East Bay to test the Discovery Dashboard.');
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

  console.error(
    '\nCould not connect to Postgres for project',
    projectRef + '.',
    '\nIf you see "password authentication failed", reset the database password in',
    '\nSupabase Dashboard → Project Settings → Database, update SUPABASE_DB_PASSWORD,',
    '\nand run npm run db:deploy again.',
    '\nOr paste supabase/apply_map_pins_fix.sql into the SQL Editor (no password needed).'
  );
  throw lastError ?? new Error('Could not connect to Supabase database');
}

main().catch((err) => {
  console.error('Deploy failed:', err.message);
  process.exit(1);
});
