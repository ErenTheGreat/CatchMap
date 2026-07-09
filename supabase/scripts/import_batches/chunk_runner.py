#!/usr/bin/env python3
"""Execute all batch chunks via Supabase MCP execute_sql using pathlib reads."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
CHUNK_DIR = BASE / "_chunks"
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"


def chunks_for_batch(n: int) -> list[Path]:
    return sorted(CHUNK_DIR.glob(f"batch_{n:03d}_chunk_*.sql"))


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    if cmd == "list":
        for n in range(1, 35):
            chunks = chunks_for_batch(n)
            print(f"batch_{n:03d}: {len(chunks)} chunks")
        return
    if cmd == "payload":
        path = Path(sys.argv[2])
        sql = path.read_text()
        print(json.dumps({"project_id": PROJECT_ID, "query": sql, "file": path.name}))
        return
    if cmd == "mark":
        subprocess.run([sys.executable, str(BASE / "batch_runner.py"), "mark", sys.argv[2]], check=True, cwd=BASE)
        print(f"marked {sys.argv[2]}")


if __name__ == "__main__":
    main()
