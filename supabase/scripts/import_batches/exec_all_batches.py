#!/usr/bin/env python3
"""Execute batches 001-034 via Supabase MCP execute_sql; mark success in batch_runner log."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"
START, END = 1, 34


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
    # This script is invoked by the agent with MCP; it prepares payloads and tracks state.
    for n in range(START, END + 1):
        name = f"batch_{n:03d}"
        sql = read_batch(n)
        payload = {"project_id": PROJECT_ID, "query": sql, "batch": n, "name": name}
        out = BASE / "_mcp_payloads" / f"{name}.json"
        out.write_text(json.dumps(payload))
        print(f"PREPARED {name} bytes={len(sql)}")


if __name__ == "__main__":
    main()
