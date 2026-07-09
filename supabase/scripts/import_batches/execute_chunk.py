#!/usr/bin/env python3
"""Print SQL for remaining chunk by 1-based index (for MCP execute_sql)."""
from __future__ import annotations

import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent


def remaining_chunks() -> list[Path]:
    out: list[Path] = []
    for n in range(19, 28):
        for c in sorted((BASE / "_chunks").glob(f"batch_{n:03d}_chunk_*.sql")):
            if n == 19 and c.name.endswith("_chunk_01.sql"):
                continue
            out.append(c)
    return out


def main() -> None:
    idx = int(sys.argv[1])
    chunks = remaining_chunks()
    state_path = BASE / "_batch_import_results.json"
    if state_path.exists():
        import json

        done = set(json.loads(state_path.read_text()).get("chunks_done", []))
        chunks = [c for c in chunks if c.name not in done]
    if idx < 1 or idx > len(chunks):
        sys.exit(f"index out of range: {idx} (1-{len(chunks)})")
    path = chunks[idx - 1]
    sys.stdout.write(path.read_text())


if __name__ == "__main__":
    main()
