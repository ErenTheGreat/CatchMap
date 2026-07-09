#!/usr/bin/env python3
"""Execute import batches 001-034 via prepared SQL files. Logs progress to _import_log.json."""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"
LOG_PATH = BASE / "_import_log.json"
START = 1
END = 34


def load_log() -> dict:
    if LOG_PATH.exists():
        return json.loads(LOG_PATH.read_text())
    return {"completed": [], "errors": [], "started_at": datetime.now(timezone.utc).isoformat()}


def save_log(log: dict) -> None:
    LOG_PATH.write_text(json.dumps(log, indent=2))


def read_batch(batch_num: int) -> str:
    return Path(BASE / f"batch_{batch_num:03d}.sql").read_text()


def main() -> None:
    batch_num = int(sys.argv[1]) if len(sys.argv) > 1 else None
    log = load_log()

    batches = [batch_num] if batch_num else range(START, END + 1)

    for n in batches:
        name = f"batch_{n:03d}"
        if name in log["completed"]:
            print(f"SKIP {name} (already completed)")
            continue
        sql = read_batch(n)
        print(f"READY {name} bytes={len(sql)}")
        # Agent calls MCP execute_sql with project_id and query=sql
        payload = {"project_id": PROJECT_ID, "query": sql, "batch": n, "file": f"{name}.sql"}
        out = BASE / "_mcp_payloads" / f"{name}.json"
        out.write_text(json.dumps(payload))
        print(f"PAYLOAD {out}")


if __name__ == "__main__":
    main()
