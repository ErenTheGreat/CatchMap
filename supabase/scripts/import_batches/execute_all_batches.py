#!/usr/bin/env python3
"""Execute all import batches via Supabase MCP-style SQL execution using pathlib reads."""
from __future__ import annotations

import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"
LOG_PATH = BASE / "_import_log.json"
START, END = 1, 34


def load_log() -> dict:
    if LOG_PATH.exists():
        return json.loads(LOG_PATH.read_text())
    return {
        "completed": [],
        "errors": [],
        "started_at": datetime.now(timezone.utc).isoformat(),
    }


def save_log(log: dict) -> None:
    log["updated_at"] = datetime.now(timezone.utc).isoformat()
    LOG_PATH.write_text(json.dumps(log, indent=2))


def read_batch_sql(n: int) -> str:
    return Path(BASE / f"batch_{n:03d}.sql").read_text()


def execute_via_psql(sql: str) -> tuple[bool, str]:
    """Try psql if DATABASE_URL is available."""
    import os

    url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not url:
        return False, "No DATABASE_URL"
    try:
        r = subprocess.run(
            ["psql", url, "-v", "ON_ERROR_STOP=1", "-c", sql],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if r.returncode == 0:
            return True, r.stdout.strip() or "OK"
        return False, r.stderr.strip() or r.stdout.strip()
    except Exception as e:
        return False, str(e)


def main() -> None:
    log = load_log()
    start = int(sys.argv[1]) if len(sys.argv) > 1 else START
    end = int(sys.argv[2]) if len(sys.argv) > 2 else END

    for n in range(start, end + 1):
        name = f"batch_{n:03d}"
        if name in log["completed"]:
            print(f"SKIP {name}")
            continue
        sql = read_batch_sql(n)
        print(f"EXEC {name} ({len(sql)} bytes)")
        ok, msg = execute_via_psql(sql)
        if ok:
            log["completed"].append(name)
            print(f"OK {name}: {msg[:200]}")
        else:
            log["errors"].append({"batch": name, "error": msg})
            print(f"FAIL {name}: {msg[:500]}")
        save_log(log)
        time.sleep(0.5)

    print(json.dumps({"completed": len(log["completed"]), "errors": len(log["errors"])}))


if __name__ == "__main__":
    main()
