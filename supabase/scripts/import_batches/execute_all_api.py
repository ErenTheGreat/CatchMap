#!/usr/bin/env python3
"""Execute all import batches 001-034 via Supabase MCP execute_sql.

Reads each batch_NNN.sql via pathlib, calls execute_sql through the
Supabase Management API database query endpoint.

Requires SUPABASE_ACCESS_TOKEN in environment (from `supabase login` or Dashboard).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"
LOG_PATH = BASE / "_import_log.json"
API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_ID}/database/query"


def load_log() -> dict:
    if LOG_PATH.exists():
        return json.loads(LOG_PATH.read_text())
    return {"completed": [], "errors": []}


def save_log(log: dict) -> None:
    log["updated_at"] = datetime.now(timezone.utc).isoformat()
    LOG_PATH.write_text(json.dumps(log, indent=2))


def read_batch(n: int) -> str:
    return Path(BASE / f"batch_{n:03d}.sql").read_text()


def mark_ok(log: dict, name: str) -> None:
    subprocess.run(
        [sys.executable, str(BASE / "batch_runner.py"), "mark", name],
        check=True,
        cwd=BASE,
    )
    if name not in log.get("completed", []):
        log.setdefault("completed", []).append(name)
    save_log(log)


def mark_fail(log: dict, name: str, err: str) -> None:
    subprocess.run(
        [sys.executable, str(BASE / "batch_runner.py"), "fail", name, err[:500]],
        check=True,
        cwd=BASE,
    )
    log.setdefault("errors", []).append(
        {"batch": name, "error": err[:500], "at": datetime.now(timezone.utc).isoformat()}
    )
    save_log(log)


def execute_sql(token: str, query: str) -> None:
    payload = json.dumps({"query": query}).encode()
    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        body = resp.read().decode()
        if resp.status >= 400:
            raise RuntimeError(f"HTTP {resp.status}: {body[:500]}")


def main() -> None:
    token = os.environ.get("SUPABASE_ACCESS_TOKEN") or os.environ.get("SUPABASE_PAT")
    if not token:
        print("SUPABASE_ACCESS_TOKEN not set. Run: supabase login", file=sys.stderr)
        sys.exit(1)

    log = load_log()
    completed = set(log.get("completed", []))
    errors = []

    for n in range(1, 35):
        name = f"batch_{n:03d}"
        if name in completed:
            print(f"SKIP {name}")
            continue
        sql = read_batch(n)
        print(f"RUN {name} ({len(sql)} bytes)...", flush=True)
        try:
            execute_sql(token, sql)
            mark_ok(log, name)
            print(f"OK {name}")
        except Exception as e:
            mark_fail(log, name, str(e))
            errors.append({"batch": name, "error": str(e)})
            print(f"FAIL {name}: {e}", file=sys.stderr)
        time.sleep(0.5)

    print(json.dumps({"completed": log.get("completed", []), "errors": errors}, indent=2))


if __name__ == "__main__":
    main()
