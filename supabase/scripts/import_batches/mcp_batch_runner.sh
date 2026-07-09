#!/usr/bin/env bash
# Emit batch SQL path and metadata for sequential MCP execute_sql calls.
set -euo pipefail
BASE="$(cd "$(dirname "$0")" && pwd)"
N="${1:?batch number 1-35}"
printf '%s\n' "$BASE/batch_$(printf '%03d' "$N").sql"
