#!/usr/bin/env python3
"""Run import batches 001-034, logging progress. Reads SQL via pathlib as specified."""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"
LOG_PATH = BASE / "_import_log.json"


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
    log["errors"].append({"batch": name, "error": err, "at": datetime.now(timezone.utc).isoformat()})
    save_log(log)


def main() -> None:
    start = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    end = int(sys.argv[2]) if len(sys.argv) > 2 else 34
    log = load_log()

    for n in range(start, end + 1):
        name = f"batch_{n:03d}"
        if name in log["completed"]:
            print(f"SKIP {name}")
            continue
        sql = read_batch(n)
        out = BASE / "_mcp_payloads" / f"{name}.json"
        out.write_text(json.dumps({"project_id": PROJECT_ID, "query": sql, "batch": n}))
        print(f"PENDING {name} bytes={len(sql)} payload={out.name}")

    print(json.dumps({"completed": log["completed"], "errors": log["errors"]}, indent=2))


if __name__ == "__main__":
    main()
