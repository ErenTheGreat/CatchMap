#!/usr/bin/env python3
"""Print execute_sql MCP arguments JSON for chunk key (e.g. 004_03)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

QUEUE = Path(__file__).resolve().parent / "_mcp_queue"


def main() -> None:
    key = sys.argv[1]
    path = QUEUE / f"mcp_invoke_{key}.json"
    if not path.exists():
        path = QUEUE / f"exec_{key}.args.json"
    if not path.exists():
        raise SystemExit(f"missing invoke payload for {key}")
    d = json.loads(path.read_text())
    out = {"project_id": d["project_id"], "query": d["query"]}
    sys.stdout.write(json.dumps(out))


if __name__ == "__main__":
    main()
