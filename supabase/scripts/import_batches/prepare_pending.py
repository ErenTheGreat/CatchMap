#!/usr/bin/env python3
"""Prepare MCP execute_sql payloads for all pending chunks."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"
STATE = BASE / "_batch_import_results.json"
OUT = BASE / "_mcp_queue"


def pending() -> list[Path]:
    state = json.loads(STATE.read_text()) if STATE.exists() else {"chunks_done": []}
    done = set(state.get("chunks_done", []))
    out: list[Path] = []
    for n in range(19, 28):
        for c in sorted((BASE / "_chunks").glob(f"batch_{n:03d}_chunk_*.sql")):
            if c.name not in done:
                out.append(c)
    return out


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "prepare"
    chunks = pending()
    if cmd == "count":
        print(len(chunks))
        return
    if cmd == "prepare":
        OUT.mkdir(exist_ok=True)
        for i, path in enumerate(chunks, 1):
            payload = {
                "project_id": PROJECT_ID,
                "query": path.read_text(),
                "chunk": path.name,
            }
            (OUT / f"pending_{i:02d}.json").write_text(json.dumps(payload))
        manifest = [{"idx": i, "chunk": c.name, "path": str(c)} for i, c in enumerate(chunks, 1)]
        (OUT / "pending_manifest.json").write_text(json.dumps(manifest, indent=2))
        print(f"prepared {len(chunks)} payloads")
        return
    if cmd == "batch":
        start = int(sys.argv[2])
        end = int(sys.argv[3])
        for i in range(start, end + 1):
            p = OUT / f"pending_{i:02d}.json"
            if not p.exists():
                continue
            d = json.loads(p.read_text())
            (OUT / f"batch_q{i}.sql").write_text(d["query"])
            print(f"{i}\t{d['chunk']}")
        return
    print("usage: count|prepare|batch START END", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
