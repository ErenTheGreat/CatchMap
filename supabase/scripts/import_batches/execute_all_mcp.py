#!/usr/bin/env python3
"""Execute batches 001-034 via Supabase MCP execute_sql using pathlib reads."""
from __future__ import annotations

import json
import subprocess
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
    return {"completed": [], "errors": []}


def read_batch(n: int) -> str:
    return Path(BASE / f"batch_{n:03d}.sql").read_text()


def mark_ok(name: str) -> None:
    subprocess.run(
        [sys.executable, str(BASE / "batch_runner.py"), "mark", name],
        check=True,
        cwd=BASE,
    )


def mark_fail(name: str, err: str) -> None:
    subprocess.run(
        [sys.executable, str(BASE / "batch_runner.py"), "fail", name, err[:500]],
        check=True,
        cwd=BASE,
    )


def main() -> None:
    """Print next batch payload for external MCP execution."""
    log = load_log()
    completed = log.get("completed", [])

    for n in range(START, END + 1):
        name = f"batch_{n:03d}"
        if name in completed:
            continue
        sql = read_batch(n)
        payload = {"project_id": PROJECT_ID, "query": sql, "batch": name}
        print(json.dumps(payload))
        return

    print(json.dumps({"done": True, "completed": completed}))


if __name__ == "__main__":
    main()
