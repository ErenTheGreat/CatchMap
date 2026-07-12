#!/usr/bin/env python3
"""Load batch SQL via pathlib; print batch number and byte size for MCP execution."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"


def load_batch(n: int) -> dict:
    sql = Path(BASE / f"batch_{n:03d}.sql").read_text()
    return {"project_id": PROJECT_ID, "query": sql, "batch": n, "name": f"batch_{n:03d}"}


def main() -> None:
    n = int(sys.argv[1])
    payload = load_batch(n)
    # Write payload for agent MCP call
    out = BASE / f"_current_batch.json"
    out.write_text(json.dumps(payload))
    print(json.dumps({"batch": payload["name"], "bytes": len(payload["query"]), "project_id": PROJECT_ID}))


if __name__ == "__main__":
    main()
