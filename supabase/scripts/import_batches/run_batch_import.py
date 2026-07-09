#!/usr/bin/env python3
"""Run all remaining chunks 19-027 via Supabase MCP execute_sql.

Reads each chunk SQL from disk and prints progress. MCP calls must be made
by the agent using the printed payload paths or execute_chunk.py output.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"
STATE = BASE / "_batch_import_results.json"


def remaining_chunks() -> list[Path]:
    out: list[Path] = []
    for n in range(19, 28):
        for c in sorted((BASE / "_chunks").glob(f"batch_{n:03d}_chunk_*.sql")):
            if n == 19 and c.name.endswith("_chunk_01.sql"):
                continue
            out.append(c)
    return out


def load_state() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {"batches_run": [], "errors": [], "chunks_done": []}


def save_state(state: dict) -> None:
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    STATE.write_text(json.dumps(state, indent=2))


def chunk_payload(path: Path) -> dict:
    return {
        "project_id": PROJECT_ID,
        "query": path.read_text(),
        "chunk": path.name,
        "batch": path.name.split("_chunk")[0],
    }


def mark_batch_complete(state: dict, batch: str) -> None:
    chunks = remaining_chunks()
    batch_chunks = [c for c in chunks if c.name.startswith(batch + "_")]
    done = set(state.get("chunks_done", []))
    if all(c.name in done for c in batch_chunks):
        if batch not in state["batches_run"]:
            state["batches_run"].append(batch)


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    state = load_state()

    if cmd == "status":
        print(json.dumps(state, indent=2))
        return

    if cmd == "init":
        state = {"batches_run": [], "errors": [], "chunks_done": []}
        save_state(state)
        print(f"init {len(remaining_chunks())} chunks")
        return

    if cmd == "pending_chunks":
        done = set(state.get("chunks_done", []))
        pending = [c for c in remaining_chunks() if c.name not in done]
        for i, c in enumerate(pending, 1):
            print(f"{i:02d}\t{c.name}")
        print(f"TOTAL {len(pending)}")
        return

    if cmd == "next":
        done = set(state.get("chunks_done", []))
        for c in remaining_chunks():
            if c.name not in done:
                p = chunk_payload(c)
                print(json.dumps({k: v for k, v in p.items() if k != "query"} | {"query_len": len(p["query"])}))
                return
        print(json.dumps({"done": True, "batches_run": state.get("batches_run", [])}))
        return

    if cmd == "payload":
        idx = int(sys.argv[2])
        done = set(state.get("chunks_done", []))
        pending = [c for c in remaining_chunks() if c.name not in done]
        p = chunk_payload(pending[idx - 1])
        print(json.dumps(p))
        return

    if cmd == "mark":
        name = sys.argv[2]
        if name not in state.setdefault("chunks_done", []):
            state["chunks_done"].append(name)
        batch = name.split("_chunk")[0]
        mark_batch_complete(state, batch)
        save_state(state)
        print(f"ok {name}")
        return

    if cmd == "fail":
        name = sys.argv[2]
        err = sys.argv[3] if len(sys.argv) > 3 else "unknown"
        state.setdefault("errors", []).append(
            {"chunk": name, "error": err, "at": datetime.now(timezone.utc).isoformat()}
        )
        save_state(state)
        print(f"fail {name}")
        return

    print("usage: init|status|next|payload <idx>|mark <chunk>|fail <chunk> <err>", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
