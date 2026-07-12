#!/usr/bin/env python3
"""Track chunk import progress for batches 010-018."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parent
STATE = BASE / "_IMPORT_CHUNKS_010_018.json"
CHUNKS = BASE / "_chunks"


def all_chunks() -> list[Path]:
    out: list[Path] = []
    for b in range(10, 19):
        for c in range(1, 5):
            p = CHUNKS / f"batch_{b:03d}_chunk_{c:02d}.sql"
            if not p.exists():
                raise FileNotFoundError(p)
            out.append(p)
    return out


def load() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {"chunks_run": 0, "completed": [], "errors": []}


def save(state: dict) -> None:
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    state["chunks_run"] = len(state.get("completed", []))
    STATE.write_text(json.dumps(state, indent=2))


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    state = load()

    if cmd == "status":
        print(json.dumps(state, indent=2))
        return

    if cmd == "pending":
        done = set(state.get("completed", []))
        pending = [p for p in all_chunks() if p.name not in done]
        for i, p in enumerate(pending):
            print(f"{i}\t{p.name}")
        print(f"TOTAL {len(pending)}")
        return

    if cmd == "round":
        r = int(sys.argv[2])
        done = set(state.get("completed", []))
        pending = [p for p in all_chunks() if p.name not in done]
        batch = pending[r * 4 : r * 4 + 4]
        for p in batch:
            print(json.dumps({"file": p.name, "bytes": len(p.read_text())}))
        return

    if cmd == "mark":
        name = sys.argv[2]
        if name not in state["completed"]:
            state["completed"].append(name)
        save(state)
        print(f"ok {name}")
        return

    if cmd == "fail":
        name = sys.argv[2]
        err = sys.argv[3] if len(sys.argv) > 3 else "unknown"
        state.setdefault("errors", []).append({"chunk": name, "error": err})
        save(state)
        print(f"fail {name}")
        return

    print("usage: status|pending|round N|mark NAME|fail NAME ERR", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
