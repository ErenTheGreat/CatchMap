#!/usr/bin/env python3
"""Read batch SQL files and emit JSON payloads for MCP execute_sql calls."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"


def load_batch(batch_num: int) -> dict:
    path = BASE / f"batch_{batch_num:03d}.sql"
    query = path.read_text()
    return {"project_id": PROJECT_ID, "query": query, "batch": batch_num, "file": path.name}


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: run_batches_mcp.py <batch_num|all>", file=sys.stderr)
        sys.exit(1)

    arg = sys.argv[1]
    if arg == "all":
        batches = range(1, 35)
    else:
        batches = [int(arg)]

    for n in batches:
        payload = load_batch(n)
        print(json.dumps(payload))


if __name__ == "__main__":
    main()
