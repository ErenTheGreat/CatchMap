#!/usr/bin/env python3
"""Load batch/chunk SQL and emit execute_sql arguments for MCP.

Usage:
  python3 load_sql_for_mcp.py batch 28
  python3 load_sql_for_mcp.py chunk 028 02
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"


def main() -> None:
    kind = sys.argv[1]
    if kind == "batch":
        n = int(sys.argv[2])
        query = (BASE / f"batch_{n:03d}.sql").read_text()
        label = f"batch_{n:03d}"
    elif kind == "chunk":
        batch, chunk = sys.argv[2], sys.argv[3]
        p = BASE / f".chunk_invoke_{batch}_{chunk}.json"
        query = json.loads(p.read_text())["query"]
        label = f"{batch}_{chunk}"
    else:
        raise SystemExit(f"unknown kind: {kind}")

    out = {"project_id": PROJECT_ID, "query": query, "label": label}
    sys.stdout.write(json.dumps(out))


if __name__ == "__main__":
    main()
