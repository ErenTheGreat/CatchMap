#!/usr/bin/env python3
"""Load chunk SQL from pending index for MCP execute_sql calls."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"


def main() -> None:
    idx = int(sys.argv[1])
    p = BASE / "_mcp_queue" / f"pending_{idx:02d}.json"
    if not p.exists():
        print(f"missing {p}", file=sys.stderr)
        sys.exit(1)
    d = json.loads(p.read_text())
    out = {
        "project_id": PROJECT_ID,
        "query": d["query"],
        "chunk": d.get("chunk", f"idx_{idx}"),
    }
    print(json.dumps(out))


if __name__ == "__main__":
    main()
