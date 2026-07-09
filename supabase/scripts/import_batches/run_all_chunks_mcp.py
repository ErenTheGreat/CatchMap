#!/usr/bin/env python3
"""Execute chunks 010-018 via Supabase MCP execute_sql (4 parallel)."""
from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
MANIFEST = BASE / "_EXEC_MANIFEST.json"
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"
PARALLEL = 4
RESULT = BASE / "_IMPORT_CHUNKS_010_018.json"


async def main() -> None:
    token = os.environ.get("SUPABASE_ACCESS_TOKEN") or os.environ.get("SUPABASE_PAT")
    if not token:
        print("ERROR: SUPABASE_ACCESS_TOKEN required", file=sys.stderr)
        sys.exit(1)

    try:
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client
    except ImportError:
        import subprocess

        subprocess.check_call([sys.executable, "-m", "pip", "install", "mcp", "-q"])
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

    items = json.loads(MANIFEST.read_text())
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

            async def run_one(item: dict) -> None:
                d = json.loads(Path(item["path"]).read_text())
                name = d["file"]
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

            await asyncio.gather(*(run_one(i) for i in items))

    summary = {
        "chunks_run": len(completed),
        "chunks_total": len(items),
        "completed": completed,
        "errors": errors,
    }
    RESULT.write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
