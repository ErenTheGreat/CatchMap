#!/usr/bin/env python3
"""Import pending chunks 019-027 via Supabase MCP execute_sql (parallel batches of 4)."""
from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"
STATE = BASE / "_batch_import_results.json"
PARALLEL = 4


def load_state() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {"batches_run": [], "errors": [], "chunks_done": []}


def save_state(state: dict) -> None:
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    STATE.write_text(json.dumps(state, indent=2))


def pending_chunks() -> list[Path]:
    state = load_state()
    done = set(state.get("chunks_done", []))
    out: list[Path] = []
    for n in range(19, 28):
        for c in sorted((BASE / "_chunks").glob(f"batch_{n:03d}_chunk_*.sql")):
            if c.name not in done:
                out.append(c)
    return out


def mark_ok(chunk: str) -> None:
    subprocess.run(
        [sys.executable, str(BASE / "run_batch_import.py"), "mark", chunk],
        check=True,
        cwd=BASE,
    )


def mark_fail(chunk: str, err: str) -> None:
    subprocess.run(
        [sys.executable, str(BASE / "run_batch_import.py"), "fail", chunk, err[:500]],
        check=True,
        cwd=BASE,
    )


async def run() -> None:
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

    files = pending_chunks()
    if not files:
        print(json.dumps(load_state(), indent=2))
        return

    sem = asyncio.Semaphore(PARALLEL)
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

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            async def run_one(path: Path) -> None:
                name = path.name
                sql = path.read_text()
                async with sem:
                    print(f"RUN {name} ({len(sql)} bytes)...", flush=True)
                    try:
                        result = await session.call_tool(
                            "execute_sql",
                            {"project_id": PROJECT_ID, "query": sql},
                        )
                        if result.isError:
                            raise RuntimeError(str(result.content))
                        mark_ok(name)
                        print(f"OK {name}", flush=True)
                    except Exception as e:
                        mark_fail(name, str(e))
                        print(f"FAIL {name}: {e}", file=sys.stderr)

            await asyncio.gather(*(run_one(p) for p in files))

    print(json.dumps(load_state(), indent=2))


if __name__ == "__main__":
    asyncio.run(run())
