#!/usr/bin/env python3
"""Track MCP chunk import progress for batches 019-027."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parent
QUEUE = BASE / "_mcp_queue"
STATE = BASE / "_mcp_import_state.json"
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"


def load() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {"completed": [], "errors": [], "started_at": datetime.now(timezone.utc).isoformat()}


def save(state: dict) -> None:
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    STATE.write_text(json.dumps(state, indent=2))


def queue_files() -> list[Path]:
    return sorted(QUEUE.glob("[0-9][0-9]_*.json"))


def next_item(state: dict) -> dict | None:
    done = set(state.get("completed", []))
    for p in queue_files():
        name = p.name
        if name not in done:
            payload = json.loads(p.read_text())
            return {
                "file": name,
                "chunk": payload.get("file", name),
                "project_id": PROJECT_ID,
                "query": payload["query"],
            }
    return None


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "next"
    state = load()

    if cmd == "status":
        print(json.dumps(state, indent=2))
        return

    if cmd == "next":
        item = next_item(state)
        if item is None:
            print(json.dumps({"done": True, "completed": state.get("completed", [])}))
            return
        out = {k: v for k, v in item.items() if k != "query"}
        out["query_len"] = len(item["query"])
        print(json.dumps(out))
        return

    if cmd == "payload":
        item = next_item(state)
        if item is None:
            print(json.dumps({"done": True}))
            return
        print(json.dumps(item))
        return

    if cmd == "mark":
        name = sys.argv[2]
        if name not in state["completed"]:
            state["completed"].append(name)
        save(state)
        print(f"ok: {name}")
        return

    if cmd == "fail":
        name = sys.argv[2]
        err = sys.argv[3] if len(sys.argv) > 3 else "unknown"
        state.setdefault("errors", []).append(
            {"file": name, "error": err, "at": datetime.now(timezone.utc).isoformat()}
        )
        save(state)
        print(f"fail: {name}")
        return

    if cmd == "init":
        state = {"completed": [], "errors": [], "started_at": datetime.now(timezone.utc).isoformat()}
        save(state)
        print(f"init: {len(queue_files())} queue files")
        return

    print("usage: init|status|next|payload|mark <file>|fail <file> <err>", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
