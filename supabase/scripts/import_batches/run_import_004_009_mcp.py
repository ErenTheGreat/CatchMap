#!/usr/bin/env python3
"""Execute batches 004-009 chunks via Supabase MCP execute_sql (4 parallel)."""
from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
QUEUE = BASE / "_mcp_queue"
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"
PARALLEL = 4
SKIP_DONE = {"004_01", "004_02", "004_03"}
RESULT = BASE / "_IMPORT_CHUNKS_004_009.json"


def chunk_keys() -> list[str]:
    keys: list[str] = []
    for b in range(4, 10):
        for c in range(1, 5):
            k = f"{b:03d}_{c:02d}"
            if k not in SKIP_DONE:
                keys.append(k)
    return keys


def load_key(key: str) -> dict:
    path = QUEUE / f"mcp_invoke_{key}.json"
    if not path.exists():
        raise FileNotFoundError(path)
    d = json.loads(path.read_text())
    return {
        "key": key,
        "file": f"batch_{key.replace('_', '_chunk_')}.sql".replace("_chunk_", "_chunk_", 1),
        "project_id": d["project_id"],
        "query": d["query"],
    }


async def main() -> None:
    token = os.environ.get("SUPABASE_ACCESS_TOKEN") or os.environ.get("SUPABASE_PAT")
    if not token:
        print("ERROR: Set SUPABASE_ACCESS_TOKEN", file=sys.stderr)
        sys.exit(1)

    try:
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client
    except ImportError:
        import subprocess

        subprocess.check_call([sys.executable, "-m", "pip", "install", "mcp", "-q"])
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

    keys = chunk_keys()
    sem = asyncio.Semaphore(PARALLEL)
    completed: list[str] = []
    errors: list[dict] = []

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

            async def run_one(key: str) -> None:
                d = load_key(key)
                name = f"batch_{key[:3]}_chunk_{key[4:]}.sql"
                async with sem:
                    print(f"RUN {name}...", flush=True)
                    try:
                        result = await session.call_tool(
                            "execute_sql",
                            {"project_id": PROJECT_ID, "query": d["query"]},
                        )
                        if result.isError:
                            raise RuntimeError(str(result.content))
                        completed.append(name)
                        print(f"OK {name}")
                    except Exception as e:
                        errors.append({"chunk": name, "error": str(e)[:500]})
                        print(f"FAIL {name}: {e}", file=sys.stderr)

            await asyncio.gather(*(run_one(k) for k in keys))

    summary = {
        "chunks_run": len(completed) + len(SKIP_DONE),
        "chunks_total": 24,
        "completed": sorted(
            [f"batch_{k[:3]}_chunk_{k[4:]}.sql" for k in SKIP_DONE] + completed
        ),
        "errors": errors,
    }
    RESULT.write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
