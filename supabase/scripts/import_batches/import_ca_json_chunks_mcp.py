#!/usr/bin/env python3
"""Import CA JSON chunks 1-42 via Supabase MCP execute_sql, 4 parallel."""
from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
CHUNK_DIR = BASE / "_ca_json_chunks"
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"
PARALLEL = 4
RESULT_FILE = BASE / "_CA_JSON_CHUNKS_IMPORT.json"


def chunk_files() -> list[Path]:
    return sorted(CHUNK_DIR.glob("chunk_*.sql"))


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
    asyncio.run(main())
