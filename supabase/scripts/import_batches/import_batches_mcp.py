#!/usr/bin/env python3
"""Import batches 001-009 via Supabase MCP execute_sql (stdio transport).

Requires SUPABASE_ACCESS_TOKEN in environment.
Usage: SUPABASE_ACCESS_TOKEN=sbp_... python3 import_batches_mcp.py [start] [end]
"""
from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"
START = int(sys.argv[1]) if len(sys.argv) > 1 else 1
END = int(sys.argv[2]) if len(sys.argv) > 2 else 9


def read_batch(n: int) -> str:
    return (BASE / f"batch_{n:03d}.sql").read_text()


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


async def main() -> None:
    token = os.environ.get("SUPABASE_ACCESS_TOKEN") or os.environ.get("SUPABASE_PAT")
    if not token:
        print("ERROR: Set SUPABASE_ACCESS_TOKEN", file=sys.stderr)
        sys.exit(1)

    try:
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "mcp", "-q"])
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

    server_params = StdioServerParameters(
        command="npx",
        args=[
            "--yes",
            "@supabase/mcp-server-supabase",
            f"--access-token={token}",
            f"--project-ref={PROJECT_ID}",
        ],
        env=os.environ.copy(),
    )

    completed: list[str] = []
    errors: list[dict] = []
    timeouts: list[str] = []

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            for n in range(START, END + 1):
                name = f"batch_{n:03d}"
                sql = read_batch(n)
                print(f"RUN {name} ({len(sql)} bytes)...", flush=True)
                try:
                    result = await session.call_tool(
                        "execute_sql",
                        {"project_id": PROJECT_ID, "query": sql},
                    )
                    if result.isError:
                        raise RuntimeError(str(result.content))
                    mark_ok(name)
                    completed.append(name)
                    print(f"OK {name}")
                except Exception as e:
                    err = str(e)
                    if "timeout" in err.lower():
                        timeouts.append(name)
                    mark_fail(name, err)
                    errors.append({"batch": name, "error": err})
                    print(f"FAIL {name}: {e}", file=sys.stderr)

    summary = {"batches_run": completed, "errors": errors, "timeouts": timeouts}
    (BASE / "_IMPORT_RESULT_001_009.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
