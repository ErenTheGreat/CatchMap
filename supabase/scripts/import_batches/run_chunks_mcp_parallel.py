#!/usr/bin/env python3
"""Execute chunks 010-018 via Supabase MCP execute_sql, 4 parallel."""
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
START = int(sys.argv[1]) if len(sys.argv) > 1 else 10
END = int(sys.argv[2]) if len(sys.argv) > 2 else 18
RESULT = BASE / f"_IMPORT_CHUNKS_{START:03d}_{END:03d}.json"


def queue_files() -> list[Path]:
    out: list[Path] = []
    for b in range(START, END + 1):
        for c in range(1, 5):
            matches = sorted(QUEUE.glob(f"*_batch_{b:03d}_chunk_{c:02d}.sql.json"))
            if not matches:
                raise FileNotFoundError(f"batch_{b:03d}_chunk_{c:02d}")
            out.append(matches[0])
    return out


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

    files = queue_files()
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

            async def run_one(path: Path) -> None:
                d = json.loads(path.read_text())
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

            await asyncio.gather(*(run_one(p) for p in files))

    summary = {
        "chunks_run": len(completed),
        "chunks_total": len(files),
        "completed": completed,
        "errors": errors,
    }
    RESULT.write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
