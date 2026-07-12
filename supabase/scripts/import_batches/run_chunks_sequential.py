#!/usr/bin/env python3
"""Print next pending chunk path for sequential MCP execute_sql runs."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
CHUNK_DIR = BASE / "_chunks"
LOG = BASE / "_import_log.json"


def completed_batches() -> set[str]:
    if not LOG.exists():
        return set()
    return set(json.loads(LOG.read_text()).get("completed", []))


def main() -> None:
    done = completed_batches()
    for n in range(1, 35):
        name = f"batch_{n:03d}"
        if name in done:
            continue
        chunks = sorted(CHUNK_DIR.glob(f"batch_{n:03d}_chunk_*.sql"))
        for c in chunks:
            print(json.dumps({"batch": name, "chunk": c.name, "path": str(c), "bytes": c.stat().st_size}))
        return
    print(json.dumps({"done": True, "completed": sorted(done)}))


if __name__ == "__main__":
    main()
