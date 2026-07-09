#!/usr/bin/env python3
"""Load batch or chunk SQL via pathlib for MCP execute_sql calls."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"


def load_batch(n: int) -> str:
    return Path(BASE / f"batch_{n:03d}.sql").read_text()


def load_chunk(batch_n: int, chunk_n: int) -> str:
    return Path(BASE / f"_chunks/batch_{batch_n:03d}_chunk_{chunk_n:02d}.sql").read_text()


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: batch <n> | chunk <batch_n> <chunk_n>", file=sys.stderr)
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "batch":
        n = int(sys.argv[2])
        query = load_batch(n)
    elif cmd == "chunk":
        bn, cn = int(sys.argv[2]), int(sys.argv[3])
        query = load_chunk(bn, cn)
    else:
        sys.exit(1)
    print(json.dumps({"project_id": PROJECT_ID, "query": query}))


if __name__ == "__main__":
    main()
