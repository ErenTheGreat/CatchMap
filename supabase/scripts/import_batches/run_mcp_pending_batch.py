#!/usr/bin/env python3
"""Print MCP batch info for pending chunk indices (for agent CallMcpTool loops)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"


def pending_count() -> int:
    state = json.loads((BASE / "_batch_import_results.json").read_text())
    done = set(state.get("chunks_done", []))
    n = 0
    for b in range(19, 28):
        for c in sorted((BASE / "_chunks").glob(f"batch_{b:03d}_chunk_*.sql")):
            if c.name not in done:
                n += 1
    return n


def load_idx(idx: int) -> dict:
    p = BASE / "_mcp_queue" / f"pending_{idx:02d}.json"
    if not p.exists():
        raise SystemExit(f"missing {p}; run: python3 prepare_pending.py prepare")
    d = json.loads(p.read_text())
    return {
        "idx": idx,
        "project_id": PROJECT_ID,
        "query": d["query"],
        "chunk": d["chunk"],
    }


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "status":
        state = json.loads((BASE / "_batch_import_results.json").read_text())
        print(json.dumps({"pending": pending_count(), **state}, indent=2))
        return
    if cmd == "batch":
        start, end = int(sys.argv[2]), int(sys.argv[3])
        for i in range(start, end + 1):
            d = load_idx(i)
            (BASE / "_mcp_queue" / f"q{i}.txt").write_text(d["query"])
            print(f"{i}\t{d['chunk']}\t{len(d['query'])}")
        return
    if cmd == "payload":
        print(json.dumps(load_idx(int(sys.argv[2]))))
        return
    print("usage: status|batch START END|payload IDX", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
