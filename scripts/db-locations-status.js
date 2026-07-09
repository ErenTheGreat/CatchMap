#!/usr/bin/env node
/**
 * Read-only locations count + category breakdown via Supabase REST (anon key from .env).
 * Usage: node scripts/db-locations-status.js
 */
const fs = require('fs');
const path = require('path');

async function headCount(url, key, filter = '') {
  const res = await fetch(`${url}/rest/v1/locations?select=id${filter}`, {
    method: 'HEAD',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'count=exact',
    },
  });
  const range = res.headers.get('content-range') || '';
  const m = range.match(/\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

async function main() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = fs.readFileSync(envPath, 'utf8');
  const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
  const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
  if (!url || !key) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
    process.exit(1);
  }

  const total = await headCount(url, key);
  const categories = ['Bay', 'Creek', 'Lake', 'Other'];
  const byCategory = {};
  for (const c of categories) {
    byCategory[c] = await headCount(url, key, `&category=eq.${encodeURIComponent(c)}`);
  }

  console.log(JSON.stringify({ total, by_category: byCategory }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
