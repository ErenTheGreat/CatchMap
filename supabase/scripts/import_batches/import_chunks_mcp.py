#!/usr/bin/env python3
"""Import chunk SQL files via Supabase MCP execute_sql in parallel batches of 4."""
from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
CHUNK_DIR = BASE / "_chunks"
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"
PARALLEL = 4
START_BATCH = int(sys.argv[1]) if len(sys.argv) > 1 else 10
END_BATCH = int(sys.argv[2]) if len(sys.argv) > 2 else 18
RESULT_FILE = BASE / f"_IMPORT_CHUNKS_{START_BATCH:03d}_{END_BATCH:03d}.json"


def chunk_files() -> list[Path]:
    files: list[Path] = []
    for b in range(START_BATCH, END_BATCH + 1):
        for c in range(1, 5):
            p = CHUNK_DIR / f"batch_{b:03d}_chunk_{c:02d}.sql"
            if not p.exists():
                raise FileNotFoundError(p)
            files.append(p)
    return files


async def run() -> None:
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

    files = chunk_files()
    completed: list[str] = []
    errors: list[dict] = []
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
                        completed.append(name)
                        print(f"OK {name}", flush=True)
                    except Exception as e:
                        err = str(e)
                        errors.append({"chunk": name, "error": err})
                        print(f"FAIL {name}: {e}", file=sys.stderr)

            await asyncio.gather(*(run_one(p) for p in files))

    summary = {
        "chunks_run": len(completed),
        "chunks_total": len(files),
        "completed": completed,
        "errors": errors,
    }
    RESULT_FILE.write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    asyncio.run(run())
