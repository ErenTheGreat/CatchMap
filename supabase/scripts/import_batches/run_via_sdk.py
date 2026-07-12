#!/usr/bin/env python3
"""Execute batches 001-034 via Supabase MCP execute_sql using pathlib reads."""
from __future__ import annotations

import json
import os
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
    try:
        from cursor_sdk import Agent
    except ImportError:
        print("cursor-sdk not installed", file=sys.stderr)
        sys.exit(1)

    api_key = os.environ.get("CURSOR_API_KEY")
    if not api_key:
        print("CURSOR_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    errors = []
    completed = []

    for n in range(START, END + 1):
        name = f"batch_{n:03d}"
        sql = read_batch(n)
        prompt = (
            f"Use the Supabase MCP server plugin-supabase-supabase execute_sql tool "
            f"with project_id {PROJECT_ID} to run this exact SQL query:\n\n{sql}"
        )
        try:
            result = Agent.prompt(prompt, api_key=api_key, local={"cwd": str(BASE.parent.parent.parent)})
            if result.status != "completed":
                raise RuntimeError(f"agent status={result.status}: {result.result}")
            mark_ok(name)
            completed.append(name)
            print(f"OK {name} ({len(sql)} bytes)")
        except Exception as e:
            mark_fail(name, str(e))
            errors.append({"batch": name, "error": str(e)})
            print(f"FAIL {name}: {e}", file=sys.stderr)

    print(json.dumps({"completed": completed, "errors": errors}, indent=2))


if __name__ == "__main__":
    main()
