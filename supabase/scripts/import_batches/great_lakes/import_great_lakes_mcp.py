#!/usr/bin/env python3
"""Import Great Lakes chunk SQL via Supabase MCP execute_sql in parallel batches of 4."""
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
RESULT_FILE = BASE / "_great_lakes_import_result.json"


def chunk_files() -> list[Path]:
    files = sorted(
        CHUNK_DIR.glob("batch_*_chunk_*.sql"),
        key=lambda p: (
            int(p.name.split("_")[1]),
            int(p.name.split("_")[3].split(".")[0]),
        ),
    )
    if not files:
        raise FileNotFoundError(f"No chunks in {CHUNK_DIR}")
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

    count_sql = (
        "SELECT COUNT(*) AS total_locations, "
        "COUNT(*) FILTER (WHERE ST_Intersects(coordinates, "
        "ST_MakeEnvelope(-92.5, 41.0, -76.0, 49.5, 4326)::geography)) AS great_lakes_count "
        "FROM public.locations;"
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            async def execute_sql(query: str):
                result = await session.call_tool(
                    "execute_sql",
                    {"project_id": PROJECT_ID, "query": query},
                )
                if result.isError:
                    raise RuntimeError(str(result.content))
                text = "".join(
                    c.text for c in (result.content or []) if hasattr(c, "text")
                )
                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    return text

            before_rows = await execute_sql(count_sql)
            before = before_rows[0] if isinstance(before_rows, list) else before_rows
            print(f"BEFORE: total={before['total_locations']}, great_lakes={before['great_lakes_count']}")

            async def run_one(path: Path) -> None:
                name = path.name
                sql = path.read_text()
                async with sem:
                    print(f"RUN {name} ({len(sql)} bytes)...", flush=True)
                    try:
                        await execute_sql(sql)
                        completed.append(name)
                        print(f"OK {name}", flush=True)
                    except Exception as e:
                        errors.append({"chunk": name, "error": str(e)})
                        print(f"FAIL {name}: {e}", file=sys.stderr)

            for i in range(0, len(files), PARALLEL):
                wave = files[i : i + PARALLEL]
                wave_num = i // PARALLEL + 1
                print(f"\nWave {wave_num}/{((len(files) - 1) // PARALLEL) + 1}", flush=True)
                await asyncio.gather(*(run_one(p) for p in wave))

            print("\nRunning ANALYZE public.locations;", flush=True)
            await execute_sql("ANALYZE public.locations;")

            after_rows = await execute_sql(count_sql)
            after = after_rows[0] if isinstance(after_rows, list) else after_rows
            print(f"AFTER: total={after['total_locations']}, great_lakes={after['great_lakes_count']}")

    summary = {
        "project_id": PROJECT_ID,
        "chunks_total": len(files),
        "chunks_ok": len(completed),
        "chunks_failed": len(errors),
        "before": before,
        "after": after,
        "added_total": int(after["total_locations"]) - int(before["total_locations"]),
        "added_great_lakes": int(after["great_lakes_count"]) - int(before["great_lakes_count"]),
        "completed": completed,
        "errors": errors,
    }
    RESULT_FILE.write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run())
