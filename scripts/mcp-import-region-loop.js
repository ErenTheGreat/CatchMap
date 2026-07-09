#!/usr/bin/env node
/**
 * Emit next MCP import payload for regional chunk/batch import loop.
 *
 * Usage:
 *   node scripts/mcp-import-region-loop.js --region gulf --index 1
 *   node scripts/mcp-import-region-loop.js --region ne --index 1
 *   node scripts/mcp-import-region-loop.js --mark-ok gulf 1
 *   node scripts/mcp-import-region-loop.js --status
 */
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/import-utils');

const PROJECT_ID = 'cpzwvlpqdzjjsdlnmfgg';
const STATUS_PATH = path.join(__dirname, '../.import/phase1_import_status.json');

const REGIONS = {
  gulf: {
    dir: path.join(__dirname, '../.import/mcp_run/gulf_coast'),
    pattern: /^batch_\d+\.sql$/,
    total: 20,
  },
  ne: {
    dir: path.join(__dirname, '../.import/mcp_run/northeast'),
    pattern: /^batch_\d+\.sql$/,
    total: 25,
  },
};

function loadStatus() {
  if (fs.existsSync(STATUS_PATH)) return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
  return { gulf: { ok: [] }, ne: { ok: [] } };
}

function saveStatus(s) {
  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
  fs.writeFileSync(STATUS_PATH, JSON.stringify(s, null, 2));
}

function listFiles(region) {
  const cfg = REGIONS[region];
  return fs
    .readdirSync(cfg.dir)
    .filter((f) => cfg.pattern.test(f))
    .sort();
}

function main() {
  const args = parseArgs(process.argv);
  const status = loadStatus();

  if (args.flags.has('status')) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  const markOk = args.flags.has('mark-ok');
  if (markOk) {
    const region = args.options._?.[0];
    const index = Number(args.options._?.[1]);
    const files = listFiles(region);
    const file = files[index - 1];
    if (!file) {
      console.error('Invalid index', region, index);
      process.exit(1);
    }
    if (!status[region]) status[region] = { ok: [] };
    if (!status[region].ok.includes(file)) status[region].ok.push(file);
    saveStatus(status);
    console.log(JSON.stringify({ marked: file, region, done: status[region].ok.length }));
    return;
  }

  const region = args.options.region;
  const index = Number(args.options.index || 1);
  const cfg = REGIONS[region];
  if (!cfg) {
    console.error('Unknown region:', region);
    process.exit(1);
  }

  const files = listFiles(region);
  const file = files[index - 1];
  if (!file) {
    console.log(JSON.stringify({ done: true, region, total: files.length }));
    return;
  }

  const sqlPath = path.join(cfg.dir, file);
  const outSql = path.join(__dirname, '../.import/mcp_query.sql');
  fs.copyFileSync(sqlPath, outSql);
  console.log(
    JSON.stringify({
      project_id: PROJECT_ID,
      region,
      index,
      total: files.length,
      file,
      sql_path: outSql,
      bytes: fs.statSync(outSql).size,
      pending: files.filter((f) => !(status[region]?.ok || []).includes(f)).length,
    })
  );
}

main();
