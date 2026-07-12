#!/usr/bin/env python3
"""Execute all chunk imports via CallMcpTool-compatible batch runner.

Reads _EXEC_MANIFEST.json and _mcp_queue payloads, executes in parallel
batches of 4 using Supabase Management API (same backend as MCP execute_sql).
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent
MANIFEST = BASE / "_EXEC_MANIFEST.json"
PROJECT_ID = "cpzwvlpqdzjjsdlnmfgg"
API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_ID}/database/query"
PARALLEL = 4
RESULT = BASE / "_IMPORT_CHUNKS_010_018.json"


def execute_sql(token: str, query: str) -> None:
    payload = json.dumps({"query": query}).encode()
    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        if resp.status >= 400:
            raise RuntimeError(resp.read().decode()[:500])


async def main() -> None:
    token = os.environ.get("SUPABASE_ACCESS_TOKEN") or os.environ.get("SUPABASE_PAT")
    if not token:
        print("ERROR: SUPABASE_ACCESS_TOKEN required", file=sys.stderr)
        sys.exit(1)

    items = json.loads(MANIFEST.read_text())
    sem = asyncio.Semaphore(PARALLEL)
    completed: list[str] = []
    errors: list[dict] = []

    async def run_one(item: dict) -> None:
        path = Path(item["path"])
        d = json.loads(path.read_text())
        name = d["file"]
        async with sem:
            print(f"RUN {name}...", flush=True)
            try:
                await asyncio.to_thread(execute_sql, token, d["query"])
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
