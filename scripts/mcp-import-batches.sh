#!/usr/bin/env bash
# Prints batch SQL for MCP execute_sql (stdout). Usage: mcp-import-batches.sh 001
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BATCH="${1:?batch number required, e.g. 001}"
cat "$ROOT/supabase/scripts/import_batches/batch_${BATCH}.sql"
