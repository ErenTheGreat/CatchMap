#!/usr/bin/env python3
"""Run batches 001-034 via Supabase MCP execute_sql using pathlib reads and logging."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"
LOG_PATH = BASE / "_import_log.json"
START, END = 1, 34


def load_log() -> dict:
    if LOG_PATH.exists():
        return json.loads(LOG_PATH.read_text())
    return {"completed": [], "errors": [], "started_at": datetime.now(timezone.utc).isoformat()}


def save_log(log: dict) -> None:
    log["updated_at"] = datetime.now(timezone.utc).isoformat()
    LOG_PATH.write_text(json.dumps(log, indent=2))


def read_batch(n: int) -> str:
    return Path(BASE / f"batch_{n:03d}.sql").read_text()


def mark_ok(log: dict, name: str) -> None:
    if name not in log["completed"]:
        log["completed"].append(name)
    save_log(log)


def mark_err(log: dict, name: str, err: str) -> None:
    log.setdefault("errors", []).append(
        {"batch": name, "error": err, "at": datetime.now(timezone.utc).isoformat()}
    )
    save_log(log)


def get_batch_payload(n: int) -> dict:
    return {
        "project_id": PROJECT_ID,
        "query": read_batch(n),
        "batch": n,
        "file": f"batch_{n:03d}.sql",
    }


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    log = load_log()

    if cmd == "status":
        print(json.dumps({"completed": log.get("completed", []), "errors": log.get("errors", [])}, indent=2))
        return

    if cmd == "next":
        for n in range(START, END + 1):
            name = f"batch_{n:03d}"
            if name not in log.get("completed", []):
                payload = get_batch_payload(n)
                print(json.dumps(payload))
                return
        print(json.dumps({"done": True, "completed": log.get("completed", [])}))
        return

    if cmd == "mark":
        name = sys.argv[2]
        mark_ok(log, name)
        print(f"marked ok: {name}")
        return

    if cmd == "fail":
        name = sys.argv[2]
        err = sys.argv[3] if len(sys.argv) > 3 else "unknown"
        mark_err(log, name, err)
        print(f"marked fail: {name}")
        return

    if cmd == "payload":
        n = int(sys.argv[2])
        print(json.dumps(get_batch_payload(n)))
        return

    print("usage: status|next|mark <batch>|fail <batch> <err>|payload <n>", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
