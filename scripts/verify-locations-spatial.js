#!/usr/bin/env node
/**
 * Post-import validation: ANALYZE locations + EXPLAIN bbox spatial query.
 *
 * Usage (from project/):
 *   node scripts/verify-locations-spatial.js
 *
 * Requires SUPABASE_DB_PASSWORD in .env
 */

const fs = require('fs');
const path = require('path');

async function main() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = fs.readFileSync(envPath, 'utf8');
  let password = process.env.SUPABASE_DB_PASSWORD;
  const urlMatch = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/);

  if (!password) {
    const match = env.match(/^SUPABASE_DB_PASSWORD=(.+)$/m);
    if (match) password = match[1].trim().replace(/^["']|["']$/g, '');
  }

  if (!password || !urlMatch) {
    console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in .env');
    process.exit(1);
  }

  const projectRef = new URL(urlMatch[1].trim()).hostname.split('.')[0];
  const { Client } = require('pg');
  const ssl = { rejectUnauthorized: false };

  const candidates = [
    {
      host: 'aws-0-us-west-1.pooler.supabase.com',
      port: 5432,
      user: `postgres.${projectRef}`,
      password,
      database: 'postgres',
      ssl,
    },
    {
      host: `db.${projectRef}.supabase.co`,
      port: 5432,
      user: 'postgres',
      password,
      database: 'postgres',
      ssl,
    },
  ];

  let lastError = null;
  for (const config of candidates) {
    const client = new Client(config);
    try {
      await client.connect();

      const migration010 = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'species_availability'
        ) AS ok
      `);
      console.log('Migration 010 (species_availability):', migration010.rows[0].ok ? 'present' : 'MISSING');

      const migration011 = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'locations' AND column_name = 'category'
        ) AS ok
      `);
      console.log('Migration 011 (locations.category):', migration011.rows[0].ok ? 'present' : 'MISSING');

      await client.query('ANALYZE public.locations');

      const counts = await client.query(
        'SELECT category, count(*)::int AS n FROM public.locations GROUP BY 1 ORDER BY 1'
      );
      console.log('Category counts:', counts.rows);

      const explain = await client.query(`
        EXPLAIN (ANALYZE, BUFFERS)
        SELECT count(*)
        FROM public.locations l
        WHERE ST_Intersects(
          l.coordinates::geometry,
          ST_MakeEnvelope(-122.5, 37.5, -122.0, 38.0, 4326)
        )
      `);
      console.log('\nSpatial EXPLAIN (expect idx_locations_coordinates):');
      explain.rows.forEach((row) => console.log(row['QUERY PLAN']));

      await client.end();
      return;
    } catch (error) {
      lastError = error;
      try {
        await client.end();
      } catch {
        // ignore
      }
    }
  }

  throw lastError ?? new Error('Could not connect');
}

main().catch((err) => {
  console.error('Verification failed:', err.message);
  process.exit(1);
});
