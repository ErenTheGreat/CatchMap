#!/usr/bin/env node
/**
 * Audit public.locations coverage by region and category.
 *
 * Usage (from project/):
 *   node scripts/audit-locations.js
 *   node scripts/audit-locations.js --min-region great_lakes
 *
 * Requires SUPABASE_DB_PASSWORD in .env, or outputs SQL for manual run.
 */

const fs = require('fs');
const path = require('path');
const { loadEnv, connectPg, parseArgs } = require('./lib/import-utils');

const AUDIT_QUERIES = {
  totals: `
    SELECT category, water_type, count(*)::int AS n
    FROM public.locations
    GROUP BY 1, 2
    ORDER BY 1, 2;
  `,
  grandTotal: `SELECT count(*)::int AS total FROM public.locations;`,
  california: `
    SELECT count(*)::int AS n FROM public.locations
    WHERE ST_Y(coordinates::geometry) BETWEEN 32.5 AND 42.0
      AND ST_X(coordinates::geometry) BETWEEN -124.5 AND -114.0;
  `,
};

function regionCountSql(regionKey, bbox) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return `
    SELECT '${regionKey}' AS region, count(*)::int AS n
    FROM public.locations
    WHERE ST_Intersects(
      coordinates,
      ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)::geography
    );
  `;
}

async function main() {
  const args = parseArgs(process.argv);
  const projectRoot = path.join(__dirname, '..');
  const regionsPath = path.join(projectRoot, 'data', 'us', 'regions.json');
  const regions = JSON.parse(fs.readFileSync(regionsPath, 'utf8'));
  const minRegion = args.options['min-region'];

  let password;
  try {
    ({ password } = loadEnv(projectRoot));
  } catch {
    password = null;
  }

  const regionQueries = Object.entries(regions)
    .filter(([, cfg]) => cfg.bbox)
    .map(([key, cfg]) => regionCountSql(key, cfg.bbox))
    .join('\nUNION ALL\n');

  const fullAuditSql = `
    ${AUDIT_QUERIES.grandTotal}
    ${AUDIT_QUERIES.totals}
    ${AUDIT_QUERIES.california}
    ${regionQueries};
  `;

  if (!password) {
    console.log('SUPABASE_DB_PASSWORD not set — audit SQL:\n');
    console.log(fullAuditSql);
    process.exit(0);
  }

  const { projectRef } = loadEnv(projectRoot);
  const client = await connectPg(projectRef, password);

  try {
    const grand = await client.query(AUDIT_QUERIES.grandTotal);
    const byCategory = await client.query(AUDIT_QUERIES.totals);
    const ca = await client.query(AUDIT_QUERIES.california);

    const regionCounts = {};
    for (const [key, cfg] of Object.entries(regions)) {
      if (!cfg.bbox) continue;
      const [minLng, minLat, maxLng, maxLat] = cfg.bbox;
      const result = await client.query(`
        SELECT count(*)::int AS n FROM public.locations
        WHERE ST_Intersects(
          coordinates,
          ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography
        );
      `, [minLng, minLat, maxLng, maxLat]);
      regionCounts[key] = result.rows[0]?.n ?? 0;
    }

    const report = {
      auditedAt: new Date().toISOString(),
      total: grand.rows[0]?.total ?? 0,
      california: ca.rows[0]?.n ?? 0,
      byCategory: byCategory.rows,
      byRegion: regionCounts,
    };

    const outPath = path.join(projectRoot, 'data', 'us', '_audit_report.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));

    if (minRegion) {
      const minCount = regionCounts[minRegion] ?? 0;
      if (minCount === 0) {
        console.error(`FAIL: region "${minRegion}" has 0 locations`);
        process.exit(1);
      }
      console.log(`PASS: region "${minRegion}" has ${minCount} locations`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Audit failed:', error.message);
  process.exit(1);
});
